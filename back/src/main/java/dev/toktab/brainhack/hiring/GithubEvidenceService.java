package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.hiring.HiringDtos.GithubJobMatchResponse;
import dev.toktab.brainhack.hiring.HiringDtos.GithubLanguageResponse;
import dev.toktab.brainhack.hiring.HiringDtos.GithubProfileResponse;
import dev.toktab.brainhack.hiring.HiringDtos.GithubRepositoryResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintSourceResponse;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class GithubEvidenceService {
    private static final Pattern GITHUB_URL = Pattern.compile(
            "https?://(?:www\\.)?github\\.com/([a-zA-Z0-9-]{1,39})(?:[/\\s?#]|$)", Pattern.CASE_INSENSITIVE);
    private static final Set<String> NON_USER_PATHS = Set.of(
            "topics", "marketplace", "features", "settings", "orgs");

    private final String githubToken;
    private final HiringMapper mapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .build();

    public GithubEvidenceService(
            @Value("${verdict.github.token:}") String githubToken,
            HiringMapper mapper) {
        this.githubToken = githubToken == null ? "" : githubToken.trim();
        this.mapper = mapper;
    }

    public GithubInvestigation investigate(List<String> links) {
        String githubLink = "";
        String username = "";
        for (String link : links) {
            var matcher = GITHUB_URL.matcher(link);
            if (!matcher.find()) continue;
            String candidateUsername = matcher.group(1);
            if (NON_USER_PATHS.contains(candidateUsername.toLowerCase(Locale.ROOT))) continue;
            githubLink = link;
            username = candidateUsername;
            break;
        }

        if (username.isBlank()) {
            return new GithubInvestigation(null, List.of(githubSource(
                    "No GitHub profile URL found in the CV.",
                    24, "0", "warn", "", "NO_LINK")));
        }

        try {
            HttpResponse<String> profileResponse = httpClient.send(
                    githubRequest(URI.create("https://api.github.com/users/" + username), Duration.ofSeconds(6)),
                    HttpResponse.BodyHandlers.ofString());

            if (profileResponse.statusCode() == 404) {
                return new GithubInvestigation(null, List.of(githubSource(
                        "GitHub URL found, but the @" + username + " profile does not exist.",
                        18, "-4", "bad", githubLink, "NOT_FOUND")));
            }
            if (profileResponse.statusCode() == 403 || profileResponse.statusCode() == 429) {
                boolean rateLimited = "0".equals(profileResponse.headers().firstValue("X-RateLimit-Remaining").orElse(""))
                        || profileResponse.headers().firstValue("Retry-After").isPresent()
                        || profileResponse.statusCode() == 429;
                if (rateLimited) {
                    return new GithubInvestigation(null, List.of(githubSource(
                            "GitHub API rate limit reached while checking @" + username + ". Configure GITHUB_TOKEN or retry later.",
                            30, "0", "warn", githubLink, "RATE_LIMITED")));
                }
                return new GithubInvestigation(null, List.of(githubSource(
                        "GitHub blocked this request for @" + username + " (403 Forbidden).",
                        30, "0", "warn", githubLink, "FORBIDDEN")));
            }
            if (profileResponse.statusCode() == 401) {
                return new GithubInvestigation(null, List.of(githubSource(
                        "GitHub rejected the configured access token (401 Unauthorized).",
                        30, "0", "warn", githubLink, "UNAUTHORIZED")));
            }
            if (profileResponse.statusCode() >= 500) {
                return new GithubInvestigation(null, List.of(githubSource(
                        "GitHub API is temporarily unavailable (status " + profileResponse.statusCode() + "). Try again shortly.",
                        30, "0", "warn", githubLink, "GITHUB_DOWN")));
            }
            if (profileResponse.statusCode() != 200) {
                return new GithubInvestigation(null, List.of(githubSource(
                        "GitHub API returned an unexpected status " + profileResponse.statusCode() + ".",
                        30, "0", "warn", githubLink, "UNEXPECTED_STATUS")));
            }

            Map<String, Object> profilePayload = mapper.map(profileResponse.body());
            HttpResponse<String> reposResponse = httpClient.send(
                    githubRequest(URI.create(
                            "https://api.github.com/users/" + username + "/repos?sort=pushed&direction=desc&per_page=30"),
                            Duration.ofSeconds(8)),
                    HttpResponse.BodyHandlers.ofString());

            List<Map<String, Object>> repoPayloads = reposResponse.statusCode() == 200
                    ? mapper.maps(reposResponse.body()) : List.of();

            List<GithubRepositoryResponse> repositories = new ArrayList<>();
            for (int index = 0; index < repoPayloads.size(); index++) {
                Map<String, Object> repo = repoPayloads.get(index);
                String repoName = stringField(repo, "name");
                String description = stringField(repo, "description");
                String language = stringField(repo, "language");
                int stars = intField(repo, "stargazers_count");
                int forks = intField(repo, "forks_count");
                boolean isFork = booleanField(repo, "fork");
                String pushedAt = stringField(repo, "pushed_at");
                Long repoId = repoId = longField(repo, "id");

                Map<String, Long> languageBytes = new LinkedHashMap<>();
                try {
                    HttpResponse<String> langResponse = httpClient.send(
                            githubRequest(URI.create(
                                    "https://api.github.com/repos/" + username + "/" + repoName + "/languages"),
                                    Duration.ofSeconds(5)),
                            HttpResponse.BodyHandlers.ofString());
                    if (langResponse.statusCode() == 200) {
                        Map<String, Object> langData = mapper.map(langResponse.body());
                        for (Map.Entry<String, Object> entry : langData.entrySet()) {
                            languageBytes.put(entry.getKey(), ((Number) entry.getValue()).longValue());
                        }
                    }
                } catch (Exception ignored) {
                }

                repositories.add(new GithubRepositoryResponse(
                        repoName,
                        description,
                        "",
                        language,
                        stars,
                        forks,
                        0,
                        0,
                        isFork,
                        false,
                        "",
                        "",
                        languageBytes,
                        "",
                        null,
                        null,
                        parseInstant(pushedAt),
                        List.of()));
            }

            return new GithubInvestigation(
                    buildProfile(username, profilePayload, repositories),
                    List.of(classifyRepositories(username, githubLink, repositories)));
        } catch (java.net.http.HttpTimeoutException | java.net.ConnectException timeoutOrConnect) {
            return new GithubInvestigation(null, List.of(githubSource(
                    "Could not reach GitHub to verify @" + username + " (connection timed out).",
                    24, "0", "warn", githubLink, "NETWORK_ERROR")));
        } catch (Exception exception) {
            return new GithubInvestigation(null, List.of(githubSource(
                    "Could not verify GitHub profile for @" + username + ": " + exception.getClass().getSimpleName() + ".",
                    24, "0", "warn", githubLink, "VERIFICATION_ERROR")));
        }
    }

    private OsintSourceResponse classifyRepositories(String username, String githubLink, List<GithubRepositoryResponse> repositories) {
        if (repositories.isEmpty()) {
            return githubSource(
                    "GitHub profile @" + username + " verified, but it has no public repositories.",
                    40, "0", "warn", githubLink, "VERIFIED_EMPTY");
        }
        List<GithubRepositoryResponse> original = repositories.stream().filter(repo -> !repo.fork()).toList();
        if (original.isEmpty()) {
            return githubSource(
                    "GitHub profile @" + username + " verified, but all " + repositories.size()
                            + " public repositories are forks with no original work.",
                    36, "0", "warn", githubLink, "VERIFIED_FORKS_ONLY");
        }
        boolean hasRecentActivity = original.stream().anyMatch(repo -> recentActivity(repo.pushedAt()));
        if (!hasRecentActivity) {
            return githubSource(
                    "GitHub profile @" + username + " verified with " + original.size()
                            + " original repositories, but none pushed in the last year.",
                    52, "+4", "warn", githubLink, "VERIFIED_STALE");
        }
        return githubSource(
                "Found " + repositories.size() + " public repositories for @" + username + ".",
                76, "+12", "good", githubLink, "VERIFIED_ACTIVE");
    }

    private OsintSourceResponse githubSource(String finding, int confidence, String impact, String tone, String url, String scenario) {
        return new OsintSourceResponse("GitHub", finding, confidence, impact, tone, url, scenario);
    }

    public GithubJobMatchResponse jobMatch(HiringProject project, GithubProfileResponse profile) {
        if (profile == null) {
            return new GithubJobMatchResponse(0, "Not available", "No GitHub profile verified.", List.of(), List.of());
        }
        String requirementsText = defaulted(project.getRequirementsText(), "");
        String projectTitle = defaulted(project.getTitle(), "");
        String normalizedRequirements = (requirementsText + " " + projectTitle).toLowerCase(Locale.ROOT);

        List<String> techTermsInJob = List.of(normalizedRequirements.split("[,\\s/]+")).stream()
                .filter(term -> term.length() > 2)
                .distinct()
                .toList();

        List<GithubRepositoryResponse> repos = profile.repositories();
        if (repos == null || repos.isEmpty()) {
            return new GithubJobMatchResponse(profile.publicRepos(), "Not available", "No repositories to evaluate.", List.of(), List.of());
        }

        int matchedRepos = 0;
        List<String> matchedLanguages = new ArrayList<>();
        List<String> uncoveredRequirements = new ArrayList<>(techTermsInJob);

        for (GithubRepositoryResponse repo : repos) {
            if (repo.fork()) continue;
            String repoLang = defaulted(repo.language(), "").toLowerCase(Locale.ROOT);
            String repoName = defaulted(repo.name(), "").toLowerCase(Locale.ROOT);
            String repoDesc = defaulted(repo.description(), "").toLowerCase(Locale.ROOT);
            String combined = repoName + " " + repoDesc + " " + repoLang;

            boolean matched = false;
            for (String term : techTermsInJob) {
                if (combined.contains(term)) {
                    matched = true;
                    uncoveredRequirements.remove(term);
                    if (!repoLang.isBlank() && !matchedLanguages.contains(repoLang)) {
                        matchedLanguages.add(repoLang);
                    }
                }
            }
            if (matched) matchedRepos++;
        }

        int totalJobTerms = techTermsInJob.size();
        int coveredTerms = totalJobTerms - uncoveredRequirements.size();
        int termCoverageScore = totalJobTerms == 0 ? 0 : Math.min(50, (int) Math.round((double) coveredTerms / totalJobTerms * 50));
        int freshnessScore = repos.stream().anyMatch(r -> r.pushedAt() != null && recentActivity(r.pushedAt())) ? 25 : 0;
        int nonForkCount = (int) repos.stream().filter(r -> !r.fork()).count();
        int nonForkBonus = nonForkCount >= 5 ? 25 : nonForkCount >= 2 ? 15 : 5;
        int score = Math.min(98, termCoverageScore + freshnessScore + nonForkBonus);

        String label = score >= 75 ? "Strong GitHub match"
                : score >= 50 ? "Partial GitHub match"
                : score > 0 ? "Weak GitHub match"
                : "No GitHub match";
        String summary = matchedLanguages.isEmpty()
                ? "No public repository evidence matching the job requirements was found."
                : "Public repositories match " + coveredTerms + " of " + totalJobTerms + " job-related terms.";

        return new GithubJobMatchResponse(score, label, summary, matchedLanguages, uncoveredRequirements);
    }

    private GithubProfileResponse buildProfile(String username, Map<String, Object> payload, List<GithubRepositoryResponse> repositories) {
        String avatarUrl = stringField(payload, "avatar_url");
        String name = stringField(payload, "name");
        String bio = stringField(payload, "bio");
        String company = stringField(payload, "company");
        String location = stringField(payload, "location");
        String blog = stringField(payload, "blog");
        int publicRepos = intField(payload, "public_repos");
        int followers = intField(payload, "followers");
        int following = intField(payload, "following");
        int depthScore = computeDepthScore(repositories);
        List<GithubLanguageResponse> languages = computeLanguages(repositories);
        return new GithubProfileResponse(
                username,
                name,
                avatarUrl,
                "https://github.com/" + username,
                bio,
                company,
                location,
                blog,
                publicRepos,
                followers,
                following,
                parseInstant(payload.get("created_at")),
                parseInstant(payload.get("updated_at")),
                parseInstant(payload.get("pushed_at")),
                depthScore,
                languages,
                repositories);
    }

    private int computeDepthScore(List<GithubRepositoryResponse> repositories) {
        if (repositories == null || repositories.isEmpty()) return 0;
        int original = 0;
        int substantial = 0;
        int recent = 0;
        for (GithubRepositoryResponse repo : repositories) {
            if (!repo.fork()) original++;
            if (repo.stars() >= 10) substantial++;
            if (repo.pushedAt() != null && recentActivity(repo.pushedAt())) recent++;
        }
        int size = repositories.size();
        return Math.min(100,
                (original * 100 / Math.max(1, size)) * 40 / 100
                        + Math.min(30, substantial * 10)
                        + Math.min(30, recent * 10));
    }

    private List<GithubLanguageResponse> computeLanguages(List<GithubRepositoryResponse> repositories) {
        if (repositories == null || repositories.isEmpty()) return List.of();
        Map<String, Long> bytes = new LinkedHashMap<>();
        Map<String, Integer> repoCount = new LinkedHashMap<>();
        for (GithubRepositoryResponse repo : repositories) {
            if (repo.languageBytes() == null) continue;
            for (Map.Entry<String, Long> entry : repo.languageBytes().entrySet()) {
                bytes.merge(entry.getKey(), entry.getValue(), Long::sum);
                repoCount.merge(entry.getKey(), 1, Integer::sum);
            }
        }
        long total = bytes.values().stream().mapToLong(Long::longValue).sum();
        if (total <= 0) return List.of();
        return bytes.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> new GithubLanguageResponse(
                        entry.getKey(),
                        repoCount.getOrDefault(entry.getKey(), 0),
                        entry.getValue(),
                        (int) Math.round(entry.getValue() * 100.0 / total)))
                .toList();
    }

    private Instant parseInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        try {
            return Instant.parse(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }

    private HttpRequest githubRequest(URI uri, Duration timeout) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri).timeout(timeout).GET();
        if (!githubToken.isBlank()) {
            builder.header("Authorization", "Bearer " + githubToken);
        }
        return builder.build();
    }

    private boolean recentActivity(Instant pushedAt) {
        return pushedAt != null && pushedAt.isAfter(Instant.now().minus(java.time.Duration.ofDays(365)));
    }

    private String stringField(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private int intField(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value instanceof Number number ? number.intValue() : 0;
    }

    private long longField(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private boolean booleanField(Map<String, Object> map, String key) {
        return Boolean.TRUE.equals(map.get(key));
    }

    private String defaulted(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
