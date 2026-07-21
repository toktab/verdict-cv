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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
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
            return new GithubInvestigation(null, List.of(new OsintSourceResponse(
                    "GitHub",
                    "No GitHub profile URL found in the CV.",
                    24, "0", "warn", ""
            )));
        }

        try {
            HttpResponse<String> profileResponse = httpClient.send(
                    githubRequest(URI.create("https://api.github.com/users/" + username), Duration.ofSeconds(6)),
                    HttpResponse.BodyHandlers.ofString());

            if (profileResponse.statusCode() == 404) {
                return new GithubInvestigation(null, List.of(new OsintSourceResponse(
                        "GitHub", "GitHub URL found, but profile did not resolve.",
                        18, "-4", "bad", githubLink)));
            }
            if (profileResponse.statusCode() != 200) {
                return new GithubInvestigation(null, List.of(new OsintSourceResponse(
                        "GitHub", "GitHub API returned status " + profileResponse.statusCode() + ".",
                        30, "0", "warn", githubLink)));
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

                List<GithubLanguageResponse> languages = new ArrayList<>();
                try {
                    HttpResponse<String> langResponse = httpClient.send(
                            githubRequest(URI.create(
                                    "https://api.github.com/repos/" + username + "/" + repoName + "/languages"),
                                    Duration.ofSeconds(5)),
                            HttpResponse.BodyHandlers.ofString());
                    if (langResponse.statusCode() == 200) {
                        Map<String, Object> langData = mapper.map(langResponse.body());
                        for (Map.Entry<String, Object> entry : langData.entrySet()) {
                            languages.add(new GithubLanguageResponse(
                                    entry.getKey(), ((Number) entry.getValue()).intValue()));
                        }
                    }
                } catch (Exception ignored) {
                }

                repositories.add(new GithubRepositoryResponse(
                        repoName, description, language, languages, stars, forks, isFork, pushedAt));
            }

            return new GithubInvestigation(
                    buildProfile(username, profilePayload, repositories),
                    List.of(new OsintSourceResponse(
                            "GitHub",
                            "Found " + repositories.size() + " public repositories for @" + username + ".",
                            76, "+12", "good", githubLink)));
        } catch (Exception exception) {
            return new GithubInvestigation(null, List.of(new OsintSourceResponse(
                    "GitHub",
                    "Could not verify GitHub profile: " + exception.getClass().getSimpleName(),
                    24, "0", "warn", githubLink)));
        }
    }

    public GithubJobMatchResponse jobMatch(HiringProject project, GithubProfileResponse profile) {
        if (profile == null) {
            return new GithubJobMatchResponse(0, 0, 0, 0, 0, 0, 0, 0, 0, List.of(), List.of());
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
            return new GithubJobMatchResponse(
                    profile.repoCount(), profile.stars(), profile.starredBy(), 0, 0, 0, 0, 0, 0, List.of(), List.of());
        }

        int matchedRepos = 0;
        int unmatchedRepos = 0;
        List<String> matchedLanguages = new ArrayList<>();
        List<String> uncoveredRequirements = new ArrayList<>(techTermsInJob);

        for (GithubRepositoryResponse repo : repos) {
            if (repo.isFork()) continue;
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
            else unmatchedRepos++;
        }

        int totalNonFork = matchedRepos + unmatchedRepos;
        double coverageRatio = totalNonFork == 0 ? 0 : (double) matchedRepos / totalNonFork;
        int matchingLanguages = matchedLanguages.size();
        int totalJobTerms = techTermsInJob.size();
        int uncoveredCount = uncoveredRequirements.size();
        int coveredTerms = totalJobTerms - uncoveredCount;

        int repoCoverageScore = (int) Math.round(coverageRatio * 30);
        int languageMatchScore = Math.min(20, matchingLanguages * 5);
        int termCoverageScore = totalJobTerms == 0 ? 0 : Math.min(30, (int) Math.round((double) coveredTerms / totalJobTerms * 30));
        int freshnessScore = repos.stream().anyMatch(r -> recentActivity(r.pushedAt())) ? 15 : 0;
        int nonForkBonus = repos.stream().filter(r -> !r.isFork()).count() >= 5 ? 5 : 0;
        int score = Math.min(98, repoCoverageScore + languageMatchScore + termCoverageScore + freshnessScore + nonForkBonus);

        return new GithubJobMatchResponse(
                profile.repoCount(), profile.stars(), profile.starredBy(),
                matchedRepos, unmatchedRepos, matchingLanguages, totalJobTerms,
                uncoveredCount, score,
                matchedLanguages, uncoveredRequirements);
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
        String createdAt = stringField(payload, "created_at");
        int stars = repositories.stream().mapToInt(GithubRepositoryResponse::stars).sum();
        int forkedRepos = (int) repositories.stream().filter(r -> r.name() != null).count();
        int uniqueLanguages = (int) repositories.stream()
                .filter(r -> r.language() != null && !r.language().isBlank())
                .map(GithubRepositoryResponse::language)
                .distinct()
                .count();
        return new GithubProfileResponse(
                username, avatarUrl, name, bio, company, location, blog, publicRepos,
                followers, following, createdAt, stars, 0, forkedRepos, uniqueLanguages,
                repositories);
    }

    private HttpRequest githubRequest(URI uri, Duration timeout) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri).timeout(timeout).GET();
        if (!githubToken.isBlank()) {
            builder.header("Authorization", "Bearer " + githubToken);
        }
        return builder.build();
    }

    private boolean recentActivity(String pushedAt) {
        if (pushedAt == null || pushedAt.isBlank()) return false;
        try {
            Instant pushed = Instant.from(DateTimeFormatter.ISO_DATE_TIME.parse(pushedAt));
            return pushed.isAfter(Instant.now().minus(java.time.Duration.ofDays(365)));
        } catch (Exception ignored) {
            return false;
        }
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
