package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ImportResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectRequest;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectResponse;
import jakarta.transaction.Transactional;
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
    private static final Pattern SENTENCE = Pattern.compile("(?<=[.!?])\\s+|\\R+");
    private static final List<String> RISKY_WORDS = List.of("expert", "senior", "led", "advanced", "proven", "guaranteed", "best", "deep");

    private final HiringProjectRepository projectRepository;
    private final HiringCandidateRepository candidateRepository;
    private final HiringMapper mapper;

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
        project.setRequirementsText(String.join("\n", request.requirements() == null ? extractRequirements(request.description()) : request.requirements()));
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
        project.getCandidates().add(candidate);
        projectRepository.save(project);
        return mapper.candidate(candidate);
    }

    @Transactional
    public CandidateResponse uploadCandidate(UserAccount owner, Long projectId, String name, String role, MultipartFile resume) {
        HiringProject project = projectEntity(owner, projectId);
        String cvText = extractResumeText(resume);
        HiringCandidate candidate = buildCandidate(project, defaulted(name, "Unnamed candidate"), defaulted(role, project.getTitle()), cvText, resume == null ? "" : resume.getOriginalFilename());
        project.getCandidates().add(candidate);
        projectRepository.save(project);
        return mapper.candidate(candidate);
    }

    @Transactional
    public CandidateResponse candidate(UserAccount owner, Long projectId, Long candidateId) {
        return mapper.candidate(candidateRepository.findByIdAndProjectIdAndProjectOwnerIdAndDeletedAtIsNull(candidateId, projectId, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found")));
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
        List<List<String>> claims = claims(cvText, requirements);
        int supported = (int) claims.stream().filter(row -> "Supported".equals(row.get(1))).count();
        int stretched = (int) claims.stream().filter(row -> "Stretched".equals(row.get(1))).count();
        int unsupported = (int) claims.stream().filter(row -> "Unsupported".equals(row.get(1))).count();
        int total = Math.max(1, supported + stretched + unsupported);
        int match = Math.min(98, Math.max(12, Math.round((supported * 100f + stretched * 55f) / total)));
        int flags = unsupported * 2 + stretched + riskyMatches(cvText).size();
        int score = Math.max(8, Math.min(99, match - unsupported * 9 - stretched * 3 - Math.min(18, flags)));

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

    private void addClaim(List<List<String>> rows, Set<String> seen, String claim, String status, String reason) {
        String clean = defaulted(claim, "");
        if (clean.isBlank() || !seen.add(normalize(clean))) {
            return;
        }
        rows.add(List.of(clean, status, reason));
    }

    private boolean hasConcreteTechnicalSignal(String normalizedText) {
        return normalizedText.matches(".*\\b(\\d+|java|spring|react|sql|docker|api|github|postgres|mysql|kubernetes|aws|azure|gcp|node|python|typescript)\\b.*");
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
        List<String> lines = splitLines(description);
        return lines.stream()
                .filter(line -> line.startsWith("-") || line.length() < 80)
                .map(line -> line.replaceFirst("^[-*]\\s*", ""))
                .filter(line -> line.length() >= 4)
                .limit(8)
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
