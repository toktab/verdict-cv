package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ImportResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunRequest;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintSourceResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectRequest;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectResponse;
import jakarta.transaction.Transactional;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class HiringService {
    private static final Set<String> STOP_WORDS = Set.of("with", "from", "into", "that", "this", "they", "them", "have", "will", "your", "and", "the", "for", "are");
    private static final Set<String> REQUIREMENT_SECTIONS = Set.of("RESPONSIBILITIES", "REQUIRED QUALIFICATIONS", "NICE TO HAVE", "TECH STACK", "IDEAL CANDIDATE PROFILE");
    private static final Set<String> STOP_REQUIREMENT_SECTIONS = Set.of("WHAT WE OFFER", "ABOUT THE ROLE", "LOCATION", "EMPLOYMENT TYPE", "LEVEL");
    private static final Set<String> TECH_TERMS = Set.of(
            "java", "spring", "boot", "security", "rest", "api", "apis", "sql", "mysql", "postgresql", "postgres",
            "jpa", "hibernate", "jwt", "authentication", "authorization", "git", "github", "docker", "compose",
            "postman", "swagger", "junit", "restassured", "testing", "oop", "object-oriented", "backend",
            "controller", "service", "repository", "debugging", "linux", "cicd", "ci/cd", "kafka", "websockets",
            "websocket", "maven", "database", "databases", "relational", "deployment", "cloud", "role-based"
    );
    private static final Pattern SENTENCE = Pattern.compile("(?<=[.!?])\\s+|\\R+");
    private static final Pattern URL = Pattern.compile("https?://[^\\s)>,]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern HANDLE = Pattern.compile("(?<![\\w.])@([a-zA-Z0-9][a-zA-Z0-9_.-]{2,38})");
    private static final Pattern GITHUB_URL = Pattern.compile("https?://(?:www\\.)?github\\.com/([a-zA-Z0-9-]{1,39})(?:[/\\s?#]|$)", Pattern.CASE_INSENSITIVE);
    private static final List<String> RISKY_WORDS = List.of("expert", "senior", "led", "advanced", "proven", "guaranteed", "best", "deep");

    private final HiringProjectRepository projectRepository;
    private final HiringCandidateRepository candidateRepository;
    private final HiringMapper mapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(4))
            .build();

    public HiringService(HiringProjectRepository projectRepository, HiringCandidateRepository candidateRepository, HiringMapper mapper) {
        this.projectRepository = projectRepository;
        this.candidateRepository = candidateRepository;
        this.mapper = mapper;
    }

    @Transactional
    public List<ProjectResponse> projects(UserAccount owner) {
        return projectRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner.getId()).stream()
                .map(mapper::project)
                .toList();
    }

    @Transactional
    public ProjectResponse project(UserAccount owner, Long id) {
        return mapper.project(projectEntity(owner, id));
    }

    @Transactional
    public ProjectResponse createProject(UserAccount owner, ProjectRequest request) {
        HiringProject project = new HiringProject();
        project.setOwner(owner);
        project.setTitle(defaulted(request.title(), "Untitled role"));
        project.setDepartment(defaulted(request.department(), "Hiring"));
        project.setLocation(defaulted(request.location(), "Remote"));
        project.setDescription(defaulted(request.description(), ""));
        List<String> requirements = cleanRequirements(request.requirements());
        if (requirements.isEmpty()) {
            requirements = extractRequirements(request.description());
        }
        project.setRequirementsText(String.join("\n", requirements));
        project.setState(defaulted(request.state(), "WAR+AI State"));
        project.setStatus(defaulted(request.status(), "Screening"));
        return mapper.project(projectRepository.save(project));
    }

    @Transactional
    public ImportResponse importSamples(UserAccount owner) {
        int imported = 0;
        int skipped = 0;
        for (ProjectRequest sample : sampleProjects()) {
            if (projectRepository.existsByOwnerIdAndTitleIgnoreCaseAndDeletedAtIsNull(owner.getId(), sample.title())) {
                skipped++;
            } else {
                createProject(owner, sample);
                imported++;
            }
        }
        return new ImportResponse(imported, skipped);
    }

    @Transactional
    public void deleteProject(UserAccount owner, Long id) {
        HiringProject project = projectEntity(owner, id);
        project.setDeletedAt(Instant.now());
        projectRepository.save(project);
    }

    @Transactional
    public CandidateResponse addCandidate(UserAccount owner, Long projectId, CandidateRequest request) {
        HiringProject project = projectEntity(owner, projectId);
        HiringCandidate candidate = buildCandidate(project, defaulted(request.name(), "Unnamed candidate"), defaulted(request.role(), project.getTitle()), defaulted(request.cvText(), ""), "");
        return mapper.candidate(candidateRepository.save(candidate));
    }

    @Transactional
    public CandidateResponse uploadCandidate(UserAccount owner, Long projectId, String name, String role, MultipartFile resume) {
        HiringProject project = projectEntity(owner, projectId);
        String cvText = extractResumeText(resume);
        HiringCandidate candidate = buildCandidate(project, defaulted(name, "Unnamed candidate"), defaulted(role, project.getTitle()), cvText, resume == null ? "" : resume.getOriginalFilename());
        return mapper.candidate(candidateRepository.save(candidate));
    }

    @Transactional
    public CandidateResponse candidate(UserAccount owner, Long projectId, Long candidateId) {
        return mapper.candidate(candidateRepository.findByIdAndProjectIdAndProjectOwnerIdAndDeletedAtIsNull(candidateId, projectId, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found")));
    }

    @Transactional
    public OsintRunResponse runOsint(UserAccount owner, Long projectId, Long candidateId, OsintRunRequest request) {
        HiringCandidate candidate = candidateRepository.findByIdAndProjectIdAndProjectOwnerIdAndDeletedAtIsNull(candidateId, projectId, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found"));
        String state = defaulted(request == null ? "" : request.state(), "strict-war-ai");
        if (!"strict-war-ai".equals(state)) {
            throw new IllegalArgumentException("SignalTrace OSINT is only available in WAR_AI State.");
        }

        String cvText = defaulted(candidate.getCvText(), "");
        List<String> links = discoveredLinks(cvText);
        List<String> usernames = discoveredUsernames(cvText, links);
        List<OsintSourceResponse> sources = new ArrayList<>();
        sources.add(new OsintSourceResponse(
                "CV link extraction",
                links.isEmpty() ? "No public profile or portfolio URLs were found in the uploaded CV." : "Found " + links.size() + " public URL(s) in the uploaded CV.",
                links.isEmpty() ? 18 : 72,
                links.isEmpty() ? "0" : "+6",
                links.isEmpty() ? "warn" : "good",
                links.isEmpty() ? "" : links.get(0)
        ));
        if (!usernames.isEmpty()) {
            sources.add(new OsintSourceResponse(
                    "Username extraction",
                    "Found likely public handle(s): " + String.join(", ", usernames.stream().limit(5).toList()) + ".",
                    62,
                    "+4",
                    "good",
                    ""
            ));
        }
        githubEvidence(links).forEach(sources::add);
        sources.add(new OsintSourceResponse(
                "Claim cross-check",
                candidate.getSupported() + " supported, " + candidate.getStretched() + " stretched, and " + candidate.getUnsupported() + " unsupported CV claims are ready for source attachment.",
                Math.max(30, Math.min(92, candidate.getScore())),
                candidate.getScore() >= 70 ? "+8" : "-4",
                candidate.getScore() >= 70 ? "good" : "warn",
                ""
        ));

        int corroborated = (int) sources.stream().filter(source -> source.confidence() >= 55).count();
        int identityConfidence = Math.min(96, Math.max(24, 35 + corroborated * 14 - candidate.getUnsupported() * 4));
        candidate.setOsint(corroborated >= 3 ? "Ready" : corroborated >= 1 ? "Partial" : "Escalate");
        candidateRepository.save(candidate);

        return new OsintRunResponse(
                state,
                candidate.getOsint(),
                identityConfidence,
                corroborated,
                candidate.getUnsupported(),
                links,
                usernames,
                sources
        );
    }

    @Transactional
    public void deleteCandidate(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateRepository.findByIdAndProjectIdAndProjectOwnerIdAndDeletedAtIsNull(candidateId, projectId, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found"));
        candidate.setDeletedAt(Instant.now());
        candidateRepository.save(candidate);
    }

    private HiringCandidate buildCandidate(HiringProject project, String name, String role, String cvText, String filename) {
        List<String> requirements = splitLines(project.getRequirementsText());
        if (requirements.isEmpty()) {
            requirements = extractRequirements(project.getDescription());
        }
        List<List<String>> claims = claims(cvText, requirements);
        int supported = (int) claims.stream().filter(row -> "Supported".equals(row.get(1))).count();
        int stretched = (int) claims.stream().filter(row -> "Stretched".equals(row.get(1))).count();
        int unsupported = (int) claims.stream().filter(row -> "Unsupported".equals(row.get(1))).count();
        int total = Math.max(1, supported + stretched + unsupported);
        int match = Math.max(requirementMatch(requirements, cvText), Math.round((supported * 100f + stretched * 55f) / total));
        match = Math.min(98, Math.max(12, match));
        int flags = unsupported * 2 + stretched + riskyMatches(cvText).size();
        int positiveEvidence = Math.min(18, supported / 2);
        int score = Math.max(8, Math.min(99, match + positiveEvidence - unsupported * 6 - stretched * 2 - Math.min(12, flags)));

        HiringCandidate candidate = new HiringCandidate();
        candidate.setProject(project);
        candidate.setName(name);
        candidate.setRole(role);
        candidate.setCvText(cvText);
        candidate.setResumeFilename(defaulted(filename, "manual-entry.txt"));
        candidate.setSupported(supported);
        candidate.setStretched(stretched);
        candidate.setUnsupported(unsupported);
        candidate.setMatchScore(match);
        candidate.setScore(score);
        candidate.setRisk(score < 45 || unsupported >= 3 ? "High" : score < 70 || stretched >= 3 ? "Medium" : "Low");
        candidate.setState(score >= 75 ? "Interview ready" : score >= 55 ? "Needs review" : "Reject");
        candidate.setOsint("Partial");
        candidate.setMemory("No prior record");
        candidate.setFlags(flags);
        candidate.setSummary(summary(candidate, project));
        candidate.setClaimsJson(mapper.json(claims));
        candidate.setAuditPhraseMatchesJson(mapper.json(riskyMatches(cvText)));
        return candidate;
    }

    private List<List<String>> claims(String cvText, List<String> requirements) {
        List<List<String>> rows = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String normalizedCv = normalize(cvText);
        String normalizedRequirements = normalize(String.join(" ", requirements));
        for (String requirement : requirements) {
            int hits = keywordHits(requirement, normalizedCv);
            String status = hits >= 2 ? "Supported" : hits == 1 ? "Stretched" : "Unsupported";
            String reason = hits >= 2
                    ? "The CV contains multiple terms aligned with this job requirement."
                    : hits == 1
                    ? "The CV partially overlaps this requirement but does not prove depth."
                    : "The CV does not provide clear evidence for this requirement.";
            addClaim(rows, seen, requirement, status, reason);
        }
        for (String sentence : SENTENCE.split(defaulted(cvText, ""))) {
            String clean = sentence.trim();
            if (clean.length() < 18) {
                continue;
            }
            String lower = normalize(clean);
            boolean risky = RISKY_WORDS.stream().anyMatch(lower::contains);
            int requirementHits = keywordHits(clean, normalizedRequirements);
            if (risky) {
                addClaim(rows, seen, clean, "Stretched", "The wording raises the proof burden and should be backed by concrete project, duration, team, or production evidence.");
            } else if (requirementHits >= 2) {
                addClaim(rows, seen, clean, "Supported", "This CV sentence directly overlaps multiple job requirement terms.");
            } else if (hasConcreteTechnicalSignal(lower)) {
                addClaim(rows, seen, clean, "Supported", "This CV sentence contains concrete technical or measurable evidence.");
            } else if (requirementHits == 1) {
                addClaim(rows, seen, clean, "Stretched", "This CV sentence has partial job overlap but needs stronger proof.");
            } else {
                addClaim(rows, seen, clean, "Unsupported", "This CV sentence is preserved for review but does not contain enough job-specific evidence by itself.");
            }
        }
        if (rows.isEmpty()) {
            addClaim(rows, seen, "Candidate CV", "Unsupported", "No readable CV text was available for analysis.");
        }
        return rows.stream().limit(120).toList();
    }

    private List<String> discoveredLinks(String text) {
        List<String> links = new ArrayList<>();
        var matcher = URL.matcher(defaulted(text, ""));
        while (matcher.find()) {
            String link = matcher.group().replaceAll("[.,;:]+$", "");
            if (!links.contains(link)) {
                links.add(link);
            }
        }
        return links.stream().limit(25).toList();
    }

    private List<String> discoveredUsernames(String text, List<String> links) {
        List<String> usernames = new ArrayList<>();
        var handleMatcher = HANDLE.matcher(defaulted(text, ""));
        while (handleMatcher.find()) {
            addUnique(usernames, handleMatcher.group(1));
        }
        for (String link : links) {
            var githubMatcher = GITHUB_URL.matcher(link);
            if (githubMatcher.find()) {
                addUnique(usernames, githubMatcher.group(1));
            }
        }
        return usernames.stream().limit(25).toList();
    }

    private List<OsintSourceResponse> githubEvidence(List<String> links) {
        List<OsintSourceResponse> rows = new ArrayList<>();
        for (String link : links) {
            var matcher = GITHUB_URL.matcher(link);
            if (!matcher.find()) {
                continue;
            }
            String username = matcher.group(1);
            if (Set.of("topics", "marketplace", "features", "settings", "orgs").contains(username.toLowerCase(Locale.ROOT))) {
                continue;
            }
            rows.add(githubProfile(username, link));
            break;
        }
        if (rows.isEmpty()) {
            rows.add(new OsintSourceResponse(
                    "GitHub",
                    "No GitHub profile URL was found in the CV, so repository language evidence could not be checked automatically.",
                    24,
                    "0",
                    "warn",
                    ""
            ));
        }
        return rows;
    }

    private OsintSourceResponse githubProfile(String username, String link) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.github.com/users/" + username))
                    .timeout(java.time.Duration.ofSeconds(6))
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", "BrainHack-SignalTrace")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Map<String, Object> payload = mapper.map(response.body());
                int publicRepos = number(payload.get("public_repos"));
                int followers = number(payload.get("followers"));
                String blog = defaulted(String.valueOf(payload.getOrDefault("blog", "")), "");
                String finding = "GitHub profile @" + username + " is public with " + publicRepos + " repos and " + followers + " followers.";
                if (!blog.isBlank() && !"null".equals(blog)) {
                    finding += " Portfolio/blog field is present.";
                }
                return new OsintSourceResponse("GitHub", finding, publicRepos > 0 ? 78 : 42, publicRepos > 0 ? "+12" : "+2", publicRepos > 0 ? "good" : "warn", link);
            }
            if (response.statusCode() == 404) {
                return new OsintSourceResponse("GitHub", "GitHub URL was found, but the profile did not resolve through the public API.", 18, "-4", "bad", link);
            }
            return new OsintSourceResponse("GitHub", "GitHub public API returned status " + response.statusCode() + " for @" + username + ".", 30, "0", "warn", link);
        } catch (IOException exception) {
            return new OsintSourceResponse("GitHub", "GitHub check failed because the public API could not be reached.", 26, "0", "warn", link);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return new OsintSourceResponse("GitHub", "GitHub check was interrupted before completion.", 20, "0", "warn", link);
        }
    }

    private void addUnique(List<String> values, String value) {
        String clean = defaulted(value, "").replaceAll("^[^a-zA-Z0-9]+|[^a-zA-Z0-9_-]+$", "");
        if (!clean.isBlank() && !values.contains(clean)) {
            values.add(clean);
        }
    }

    private int number(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private void addClaim(List<List<String>> rows, Set<String> seen, String claim, String status, String reason) {
        String clean = defaulted(claim, "");
        if (clean.isBlank() || !seen.add(normalize(clean))) {
            return;
        }
        rows.add(List.of(clean, status, reason));
    }

    private boolean hasConcreteTechnicalSignal(String normalizedText) {
        if (normalizedText.matches(".*\\b\\d+\\b.*")) {
            return true;
        }
        return TECH_TERMS.stream().anyMatch(term -> normalizedText.matches(".*\\b" + Pattern.quote(term) + "\\b.*"));
    }

    private List<Map<String, Object>> riskyMatches(String text) {
        List<Map<String, Object>> matches = new ArrayList<>();
        String lower = defaulted(text, "").toLowerCase(Locale.ROOT);
        for (String word : RISKY_WORDS) {
            int index = lower.indexOf(word);
            if (index >= 0) {
                Map<String, Object> match = new LinkedHashMap<>();
                match.put("id", "server-" + word + "-" + index);
                match.put("text", text.substring(index, Math.min(text.length(), index + word.length())));
                match.put("start", index);
                match.put("end", index + word.length());
                match.put("label", "Inflated wording");
                match.put("category", "claim-risk");
                match.put("risk", word.equals("senior") || word.equals("expert") || word.equals("led") ? "High" : "Medium");
                match.put("severity", word.equals("senior") || word.equals("expert") || word.equals("led") ? "high" : "medium");
                match.put("why", "This phrase needs concrete project, duration, team, or production evidence.");
                match.put("safer", "Replace broad wording with specific scope and evidence.");
                matches.add(match);
            }
        }
        return matches;
    }

    private int keywordHits(String requirement, String normalizedCv) {
        int hits = 0;
        for (String word : normalize(requirement).split(" ")) {
            if (word.length() >= 4 && !STOP_WORDS.contains(word) && normalizedCv.contains(word)) {
                hits++;
            }
        }
        return hits;
    }

    private int requirementMatch(List<String> requirements, String cvText) {
        if (requirements.isEmpty()) {
            return 12;
        }
        String normalizedCv = normalize(cvText);
        int covered = 0;
        int partial = 0;
        for (String requirement : requirements) {
            int hits = keywordHits(requirement, normalizedCv);
            if (hits >= 2 || shortTechRequirementCovered(requirement, normalizedCv)) {
                covered++;
            } else if (hits == 1) {
                partial++;
            }
        }
        return Math.round(((covered * 100f) + (partial * 45f)) / requirements.size());
    }

    private boolean shortTechRequirementCovered(String requirement, String normalizedCv) {
        String normalizedRequirement = normalize(requirement);
        if (normalizedRequirement.length() < 4) {
            return false;
        }
        return TECH_TERMS.stream()
                .filter(normalizedRequirement::contains)
                .anyMatch(term -> normalizedCv.matches(".*\\b" + Pattern.quote(term) + "\\b.*"));
    }

    private String extractResumeText(MultipartFile resume) {
        if (resume == null || resume.isEmpty()) {
            throw new IllegalArgumentException("Resume file is required");
        }
        String name = defaulted(resume.getOriginalFilename(), "").toLowerCase(Locale.ROOT);
        try {
            if (name.endsWith(".pdf")) {
                try (InputStream input = resume.getInputStream(); PDDocument document = PDDocument.load(input)) {
                    return new PDFTextStripper().getText(document);
                }
            }
            if (name.endsWith(".txt")) {
                return new String(resume.getBytes());
            }
            if (name.endsWith(".docx")) {
                try (InputStream input = resume.getInputStream();
                     XWPFDocument document = new XWPFDocument(input);
                     XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
                    return extractor.getText();
                }
            }
            throw new IllegalArgumentException("Upload a PDF, DOCX, or TXT resume.");
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read resume file");
        }
    }

    private HiringProject projectEntity(UserAccount owner, Long id) {
        return projectRepository.findByIdAndOwnerIdAndDeletedAtIsNull(id, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    private List<ProjectRequest> sampleProjects() {
        return List.of(
                new ProjectRequest(
                        "Backend Java Engineer",
                        "Platform",
                        "Tbilisi / Remote",
                        "Build secure Spring Boot APIs for a claim-audit product.\nResponsibilities:\n- Own REST API design\n- Maintain SQL-backed services\nRequirements:\n- Java and Spring Boot\n- SQL and authentication\n- Docker basics\nPreferred Qualifications:\n- GitHub portfolio with backend projects",
                        List.of("Java and Spring Boot", "SQL and authentication", "REST API design", "Docker basics", "Public project evidence"),
                        "WAR+AI State",
                        "Screening"),
                new ProjectRequest(
                        "Frontend Verification Analyst",
                        "Trust",
                        "Remote",
                        "Review candidate portfolios and produce structured verification reports.\nRequirements:\n- React\n- Evidence review\n- Clear technical writing",
                        List.of("React", "Evidence review", "Technical writing", "Portfolio analysis"),
                        "Person State",
                        "Screening")
        );
    }

    private List<String> extractRequirements(String description) {
        if (description == null || description.isBlank()) {
            return List.of();
        }
        List<String> requirements = new ArrayList<>();
        boolean inRelevantSection = false;
        for (String rawLine : description.split("\\R+")) {
            String line = rawLine.trim();
            if (line.isBlank()) {
                continue;
            }
            String heading = line.replace(":", "").trim().toUpperCase(Locale.ROOT);
            if (REQUIREMENT_SECTIONS.contains(heading)) {
                inRelevantSection = true;
                continue;
            }
            if (STOP_REQUIREMENT_SECTIONS.contains(heading)) {
                inRelevantSection = false;
                continue;
            }
            boolean bullet = line.startsWith("-") || line.startsWith("*");
            String clean = line.replaceFirst("^[-*]\\s*", "").trim();
            if (inRelevantSection && bullet && clean.length() >= 4 && !"requirements".equalsIgnoreCase(clean)) {
                requirements.add(clean);
            }
        }
        if (requirements.isEmpty()) {
            for (String line : splitLines(description)) {
                String normalized = normalize(line);
                if (hasConcreteTechnicalSignal(normalized) && line.length() <= 140) {
                    requirements.add(line);
                }
            }
        }
        return requirements.stream().distinct().limit(30).toList();
    }

    private List<String> cleanRequirements(List<String> requirements) {
        if (requirements == null) {
            return List.of();
        }
        return requirements.stream()
                .map(value -> value == null ? "" : value.trim().replaceFirst("^[-*]\\s*", "").trim())
                .filter(value -> value.length() >= 4)
                .filter(value -> !Set.of("requirements", "required qualifications", "nice to have").contains(value.toLowerCase(Locale.ROOT)))
                .distinct()
                .toList();
    }

    private List<String> splitLines(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        for (String line : text.split("\\R+")) {
            String clean = line.trim().replaceFirst("^[-*]\\s*", "");
            if (!clean.isBlank() && !clean.endsWith(":")) {
                lines.add(clean);
            }
        }
        return lines;
    }

    private String summary(HiringCandidate candidate, HiringProject project) {
        return candidate.getName() + " scored " + candidate.getScore() + "% for " + project.getTitle()
                + " with " + candidate.getSupported() + " supported, " + candidate.getStretched()
                + " stretched, and " + candidate.getUnsupported() + " unsupported signals.";
    }

    private String normalize(String value) {
        return defaulted(value, "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9+#. ]", " ").replaceAll("\\s+", " ").trim();
    }

    private String defaulted(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isBlank() ? fallback : clean;
    }
}
