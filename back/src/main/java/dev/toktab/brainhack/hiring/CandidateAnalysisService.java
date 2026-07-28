package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.ats.AtsKeywordCatalog;
import dev.toktab.brainhack.audit.AnalyzedVerdict;
import dev.toktab.brainhack.audit.AuditAnalysisResult;
import dev.toktab.brainhack.audit.AuditPromptCatalog;
import dev.toktab.brainhack.audit.CheckStateIds;
import dev.toktab.brainhack.audit.FingerprintService;
import dev.toktab.brainhack.audit.StateAnalysisOrchestrator;
import dev.toktab.brainhack.audit.VerdictStatus;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateAnalysisStateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class CandidateAnalysisService {
    private static final int MAX_CANDIDATE_AI_EVIDENCE_CHARS = 120_000;
    private static final Pattern SENTENCE = Pattern.compile("(?<=[.!?])\\s+|\\R+");
    private static final Set<String> STOP_WORDS = Set.of(
            "with", "from", "into", "that", "this", "they", "them", "have", "will", "your",
            "and", "the", "for", "are", "using", "use", "basic", "basics", "knowledge",
            "understanding", "experience", "familiarity", "ability", "develop", "maintain",
            "build", "improve", "work", "works", "working", "help", "assist", "follow",
            "principles", "tools", "similar", "good", "code", "clear", "role", "candidate");
    private static final Pattern URL = Pattern.compile(
            "(?:https?://[^\\s)>,|]+|(?<![\\w@.-])(?:www\\.)?(?:github\\.com|linkedin\\.com|stackoverflow\\.com|medium\\.com|x\\.com|twitter\\.com)/[^\\s)>,|]+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern HANDLE = Pattern.compile("(?<![\\w.])@([a-zA-Z0-9][a-zA-Z0-9_.-]{2,38})");
    private static final Pattern EMAIL = Pattern.compile("(?i)(?<![a-z0-9._%+-])([a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,})(?![a-z0-9._%+-])");
    private static final Pattern GITHUB_URL = Pattern.compile(
            "https?://(?:www\\.)?github\\.com/([a-zA-Z0-9-]{1,39})(?:[/\\s?#]|$)", Pattern.CASE_INSENSITIVE);

    private final HiringCandidateRepository candidateRepository;
    private final CandidateAnalysisRunRepository analysisRunRepository;
    private final CandidateReviewNoteRepository noteRepository;
    private final CandidateClaimRepository claimRepository;
    private final HiringMapper mapper;
    private final AtsKeywordCatalog atsKeywordCatalog;
    private final ProjectStateService projectStateService;
    private final StateAnalysisOrchestrator stateAnalysisOrchestrator;
    private final FingerprintService fingerprintService;
    private final HiringProjectService projectService;

    public CandidateAnalysisService(
            HiringCandidateRepository candidateRepository,
            CandidateAnalysisRunRepository analysisRunRepository,
            CandidateReviewNoteRepository noteRepository,
            CandidateClaimRepository claimRepository,
            HiringMapper mapper,
            AtsKeywordCatalog atsKeywordCatalog,
            ProjectStateService projectStateService,
            StateAnalysisOrchestrator stateAnalysisOrchestrator,
            FingerprintService fingerprintService,
            HiringProjectService projectService) {
        this.candidateRepository = candidateRepository;
        this.analysisRunRepository = analysisRunRepository;
        this.noteRepository = noteRepository;
        this.claimRepository = claimRepository;
        this.mapper = mapper;
        this.atsKeywordCatalog = atsKeywordCatalog;
        this.projectStateService = projectStateService;
        this.stateAnalysisOrchestrator = stateAnalysisOrchestrator;
        this.fingerprintService = fingerprintService;
        this.projectService = projectService;
    }

    public HiringCandidate buildCandidate(HiringProject project, String name, String role,
                                          String cvText, String filename) {
        return buildCandidate(project, name, role, cvText, filename, null, analysisStateFromProject(project));
    }

    public HiringCandidate buildCandidate(HiringProject project, String name, String role,
                                          String cvText, String filename, Long excludedCandidateId) {
        return buildCandidate(project, name, role, cvText, filename, excludedCandidateId, analysisStateFromProject(project));
    }

    public HiringCandidate buildCandidate(HiringProject project, String name, String role,
                                          String cvText, String filename, Long excludedCandidateId, String analysisState) {
        CandidateAnalysisPolicy policy = analysisPolicy(analysisState);
        List<String> requirements = splitLines(project.getRequirementsText());
        if (requirements.isEmpty()) {
            requirements = projectService.extractRequirements(project.getDescription());
        }
        if (requirements.isEmpty()) {
            requirements = List.of(project.getTitle() + " role requirements");
        }
        requirements = weightedRubricRequirements(project, requirements);
        List<String> techTerms = analysisTechTerms(project);
        List<List<String>> baselineClaims = claims(cvText, requirements, techTerms);
        AuditAnalysisResult stateAnalysis = stateAnalysisOrchestrator.analyze(
                analysisState,
                baselineClaims.stream().map(row -> row.get(0)).toList(),
                trimCandidateEvidence(cvText));
        List<List<String>> claimsResult = candidateClaims(baselineClaims, stateAnalysis);
        int supported = (int) claimsResult.stream().filter(row -> "Supported".equals(row.get(1))).count();
        int stretched = (int) claimsResult.stream().filter(row -> "Stretched".equals(row.get(1))).count();
        int unsupported = (int) claimsResult.stream().filter(row -> "Unsupported".equals(row.get(1))).count();
        int total = Math.max(1, supported + stretched + unsupported);

        // Scoring
        int match = Math.max(requirementMatch(requirements, cvText, techTerms),
                Math.round((supported * 100f + stretched * policy.stretchedMatchWeight()) / total));
        match = Math.min(98, Math.max(12, match));
        int flags = unsupported * policy.unsupportedFlagWeight()
                + stretched * policy.stretchedFlagWeight()
                + riskyMatches(project, cvText).size() * policy.riskyPhraseWeight();
        int positiveEvidence = Math.min(policy.positiveEvidenceCap(), supported / 2);
        int score = Math.max(8, Math.min(99,
                match + positiveEvidence
                        - unsupported * policy.unsupportedScorePenalty()
                        - stretched * policy.stretchedScorePenalty()
                        - Math.min(policy.flagPenaltyCap(), flags)));

        HiringCandidate candidate = new HiringCandidate();
        String candidateEmail = extractCandidateEmail(cvText);
        List<HiringCandidate> priorApplications = priorApplications(project, name, candidateEmail, excludedCandidateId);
        candidate.setProject(project);
        candidate.setName(name);
        candidate.setCandidateEmail(candidateEmail);
        candidate.setRole(role);
        candidate.setCvText(cvText);
        candidate.setResumeFilename(defaulted(filename, "manual-entry.txt"));
        candidate.setSupported(supported);
        candidate.setStretched(stretched);
        candidate.setUnsupported(unsupported);
        candidate.setMatchScore(match);
        candidate.setEvidenceScore(0);
        candidate.setGithubMatchScore(0);
        candidate.setReviewerScore(0);
        candidate.setScore(score);
        candidate.setRisk(score < policy.highRiskScore() || unsupported >= policy.highRiskUnsupported()
                ? "High"
                : score < policy.mediumRiskScore() || stretched >= policy.mediumRiskStretched() ? "Medium" : "Low");
        candidate.setState("Unreviewed");
        candidate.setOsint("Partial");
        candidate.setMemory(memoryStatus(priorApplications, unsupported));
        candidate.setAnalysisState(analysisState);
        candidate.setAnalysisEngine(stateAnalysis.engine());
        candidate.setAnalysisPromptVersion(
                stateAnalysis.engine().contains("LLM_")
                        ? AuditPromptCatalog.VERSION : "local-state-policy-v2");
        candidate.setAnalysisCompletedAt(Instant.now());
        candidate.setPromptTokens(stateAnalysis.usage().promptTokens());
        candidate.setCompletionTokens(stateAnalysis.usage().completionTokens());
        candidate.setTotalTokens(stateAnalysis.usage().totalTokens());
        candidate.setEstimatedCostUsd(stateAnalysis.usage().estimatedCostUsd());
        candidate.setInitializedAnalysisStatesJson(mapper.json(List.of(analysisState)));
        candidate.setMemoryHistoryJson(mapper.json(priorApplications.stream()
                .map(prior -> Map.<String, Object>of(
                        "candidateId", prior.getId(),
                        "projectId", prior.getProject().getId(),
                        "projectTitle", prior.getProject().getTitle(),
                        "score", prior.getScore(),
                        "risk", prior.getRisk(),
                        "unsupported", prior.getUnsupported(),
                        "submittedAt", prior.getCreatedAt().toString()))
                .toList()));
        candidate.setFlags(flags);
        candidate.setSummary(summary(candidate, project));
        candidate.setClaimsJson(mapper.json(claimsResult));
        candidate.setAuditPhraseMatchesJson(mapper.json(riskyMatches(project, cvText)));
        return candidate;
    }

    public void applyCandidateAnalysis(HiringCandidate candidate, HiringCandidate refreshed) {
        candidate.setScore(refreshed.getScore());
        candidate.setMatchScore(refreshed.getMatchScore());
        candidate.setRisk(refreshed.getRisk());
        candidate.setCandidateEmail(refreshed.getCandidateEmail());
        candidate.setMemory(refreshed.getMemory());
        candidate.setMemoryHistoryJson(refreshed.getMemoryHistoryJson());
        candidate.setFlags(refreshed.getFlags());
        candidate.setSupported(refreshed.getSupported());
        candidate.setStretched(refreshed.getStretched());
        candidate.setUnsupported(refreshed.getUnsupported());
        candidate.setSummary(refreshed.getSummary());
        candidate.setClaimsJson(refreshed.getClaimsJson());
        candidate.setAuditPhraseMatchesJson(refreshed.getAuditPhraseMatchesJson());
        candidate.setAnalysisEngine(refreshed.getAnalysisEngine());
        candidate.setAnalysisPromptVersion(refreshed.getAnalysisPromptVersion());
        candidate.setAnalysisCompletedAt(refreshed.getAnalysisCompletedAt());
        candidate.setPromptTokens(refreshed.getPromptTokens());
        candidate.setCompletionTokens(refreshed.getCompletionTokens());
        candidate.setTotalTokens(refreshed.getTotalTokens());
        candidate.setEstimatedCostUsd(refreshed.getEstimatedCostUsd());
    }

    public HiringCandidate saveAnalyzedCandidate(HiringCandidate candidate) {
        if (candidate.getScore() <= 0 || candidate.getMatchScore() <= 0
                || candidate.getRisk() == null || candidate.getRisk().isBlank()) {
            throw new IllegalStateException("Candidate scoring must run before saving");
        }
        return candidateRepository.saveAndFlush(candidate);
    }

    public HiringCandidate saveAndRecord(HiringCandidate candidate, UserAccount actor) {
        HiringCandidate saved = saveAnalyzedCandidate(candidate);
        recordAnalysisRun(saved, actor);
        saveClaims(saved, null);
        return saved;
    }

    public void recordAnalysisRun(HiringCandidate candidate, UserAccount actor) {
        CandidateAnalysisRun run = new CandidateAnalysisRun();
        run.setCandidate(candidate);
        run.setProject(candidate.getProject());
        run.setTriggeredBy(actor);
        run.setStateId(candidate.getAnalysisState());
        run.setEngine(candidate.getAnalysisEngine());
        run.setPromptVersion(candidate.getAnalysisPromptVersion());
        run.setResumeFingerprint(fingerprintService.sha256(defaulted(candidate.getCvText(), "")));
        run.setRecommendationScore(candidate.getScore());
        run.setFitScore(candidate.getMatchScore());
        run.setEvidenceScore(candidate.getEvidenceScore());
        run.setGithubMatchScore(candidate.getGithubMatchScore());
        run.setReviewerScore(candidate.getReviewerScore());
        run.setSupported(candidate.getSupported());
        run.setStretched(candidate.getStretched());
        run.setUnsupported(candidate.getUnsupported());
        run.setPromptTokens(candidate.getPromptTokens());
        run.setCompletionTokens(candidate.getCompletionTokens());
        run.setEstimatedCostUsd(candidate.getEstimatedCostUsd());
        run.setClaimsJson(candidate.getClaimsJson());
        CandidateAnalysisRun saved = analysisRunRepository.save(run);
        saveClaims(candidate, saved);
    }

    public void restoreAnalysisRun(HiringCandidate candidate, CandidateAnalysisRun run) {
        candidate.setScore(run.getRecommendationScore());
        candidate.setMatchScore(run.getFitScore());
        candidate.setSupported(run.getSupported());
        candidate.setStretched(run.getStretched());
        candidate.setUnsupported(run.getUnsupported());
        candidate.setAnalysisEngine(run.getEngine());
        candidate.setAnalysisPromptVersion(run.getPromptVersion());
        candidate.setAnalysisCompletedAt(run.getCreatedAt());
        candidate.setPromptTokens(run.getPromptTokens());
        candidate.setCompletionTokens(run.getCompletionTokens());
        candidate.setTotalTokens(run.getPromptTokens() + run.getCompletionTokens());
        candidate.setEstimatedCostUsd(run.getEstimatedCostUsd());
        candidate.setClaimsJson(run.getClaimsJson());
    }

    @Transactional
    public CandidateResponse reanalyze(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        HiringCandidate refreshed = buildCandidate(candidate.getProject(), candidate.getName(), candidate.getRole(),
                candidate.getCvText(), candidate.getResumeFilename(), candidate.getId(), candidate.getAnalysisState());
        applyCandidateAnalysis(candidate, refreshed);
        HiringCandidate saved = saveAnalyzedCandidate(candidate);
        recordAnalysisRun(saved, owner);
        CandidateResponse response = mapper.candidate(saved);
        recordCandidateActivity(candidate, owner, "candidate_reanalyze", "Reanalyzed candidate " + candidate.getName(),
                "info", "Candidate scoring and phrase checks were refreshed.");
        return response;
    }

    @Transactional
    public CandidateResponse updateAnalysisState(UserAccount actor, Long projectId, Long candidateId,
                                                  CandidateAnalysisStateRequest request) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        String state = normalizeAnalysisState(request.state());
        String previous = candidate.getAnalysisState();
        List<String> initialized = new ArrayList<>(mapper.strings(candidate.getInitializedAnalysisStatesJson()));
        boolean newlyInitialized = request.initialize() && !initialized.contains(state);
        boolean analyzeForState = request.initialize();

        candidate.setAnalysisState(state);
        if (newlyInitialized) {
            initialized.add(state);
            candidate.setInitializedAnalysisStatesJson(mapper.json(initialized));
        }
        if (analyzeForState) {
            HiringCandidate refreshed = buildCandidate(candidate.getProject(), candidate.getName(), candidate.getRole(),
                    candidate.getCvText(), candidate.getResumeFilename(), candidate.getId(), state);
            applyCandidateAnalysis(candidate, refreshed);
        } else if (initialized.contains(state)) {
            CandidateAnalysisRun existing = analysisRunRepository
                    .findFirstByCandidateIdAndStateIdOrderByCreatedAtDesc(candidate.getId(), state).orElse(null);
            if (existing != null) {
                restoreAnalysisRun(candidate, existing);
            } else {
                HiringCandidate refreshed = buildCandidate(candidate.getProject(), candidate.getName(), candidate.getRole(),
                        candidate.getCvText(), candidate.getResumeFilename(), candidate.getId(), state);
                applyCandidateAnalysis(candidate, refreshed);
                analyzeForState = true;
            }
        }
        candidateRepository.save(candidate);
        if (analyzeForState) recordAnalysisRun(candidate, actor);

        if (!state.equals(previous) || newlyInitialized) {
            String action = newlyInitialized
                    ? "Initialized " + analysisStateLabel(state) + " for " + candidate.getName()
                    : "Selected " + analysisStateLabel(state) + " for " + candidate.getName();
            recordCandidateActivity(candidate, actor, "candidate_analysis_state", action, "info",
                    "Candidate analysis state changed from " + analysisStateLabel(previous) + " to "
                            + analysisStateLabel(state) + ".");
        }
        return mapper.candidate(candidate);
    }

    public void recordCandidateActivity(HiringCandidate candidate, UserAccount actor, String action,
                                         String label, String severity, String description) {
        projectService.recordActivity(candidate.getProject(), actor, action, label, severity, description);
    }

    private static final Set<String> REQUIREMENT_SECTIONS = Set.of(
            "RESPONSIBILITIES", "REQUIRED QUALIFICATIONS", "NICE TO HAVE", "TECH STACK", "IDEAL CANDIDATE PROFILE");

    private String normalizeAnalysisState(String state) {
        String normalized = defaulted(state, "").trim().toLowerCase(Locale.ROOT);
        if (!Set.of(CheckStateIds.LIGHT, CheckStateIds.WAR, CheckStateIds.PERSON, CheckStateIds.STRICT_WAR_AI)
                .contains(normalized)) {
            throw new IllegalArgumentException("Unsupported candidate analysis state");
        }
        return normalized;
    }

    private String analysisStateFromProject(HiringProject project) {
        String configuredState = projectSetting(project, "defaultAuditState", project.getState());
        return analysisStateFromProjectValue(configuredState);
    }

    private String projectSetting(HiringProject project, String key, String fallback) {
        Object value = projectStateService.effectiveSettings(project).get(key);
        String clean = value == null ? "" : String.valueOf(value).trim();
        return clean.isBlank() ? fallback : clean;
    }

    private String analysisStateFromProjectValue(String projectState) {
        String normalized = defaulted(projectState, "").toLowerCase(Locale.ROOT);
        if (normalized.contains("light")) return CheckStateIds.LIGHT;
        if (normalized.contains("person")) return CheckStateIds.PERSON;
        if (normalized.contains("war+ai") || normalized.contains("war_ai") || normalized.contains("strict"))
            return CheckStateIds.STRICT_WAR_AI;
        if (normalized.contains("war")) return CheckStateIds.WAR;
        return CheckStateIds.STRICT_WAR_AI;
    }

    private String analysisStateLabel(String state) {
        return switch (defaulted(state, "")) {
            case CheckStateIds.LIGHT -> "Light State";
            case CheckStateIds.WAR -> "WAR State";
            case CheckStateIds.PERSON -> "Person_AI State";
            case CheckStateIds.STRICT_WAR_AI -> "WAR_AI State";
            default -> "default state";
        };
    }

    private String trimCandidateEvidence(String cvText) {
        String evidence = defaulted(cvText, "");
        return evidence.length() <= MAX_CANDIDATE_AI_EVIDENCE_CHARS
                ? evidence : evidence.substring(0, MAX_CANDIDATE_AI_EVIDENCE_CHARS);
    }

    private List<List<String>> candidateClaims(List<List<String>> baselineClaims, AuditAnalysisResult analysis) {
        boolean aiCompleted = analysis.engine().contains("LLM_");
        Map<Integer, AnalyzedVerdict> verdicts = analysis.verdicts().stream()
                .collect(java.util.stream.Collectors.toMap(
                        AnalyzedVerdict::sentenceIndex, v -> v, (first, ignored) -> first));
        List<List<String>> rows = new ArrayList<>();
        for (int index = 0; index < baselineClaims.size(); index++) {
            List<String> baseline = baselineClaims.get(index);
            AnalyzedVerdict verdict = verdicts.get(index);
            if (!aiCompleted || verdict == null || verdict.status() == VerdictStatus.NOT_A_CLAIM) {
                rows.add(baseline);
                continue;
            }
            rows.add(List.of(baseline.get(0), candidateStatus(verdict.status()),
                    verdict.explanation() + ("No evidence found.".equals(verdict.evidencePointer())
                            ? "" : " Evidence: " + verdict.evidencePointer())));
        }
        return rows.stream().limit(120).toList();
    }

    private String candidateStatus(VerdictStatus status) {
        return switch (status) {
            case SUPPORTED -> "Supported";
            case STRETCHED -> "Stretched";
            case UNSUPPORTED -> "Unsupported";
            case GAP, NOT_A_CLAIM -> "Gap";
        };
    }

    public List<String> discoveredLinks(String text) {
        return discoverPublicLinks(text);
    }

    static List<String> discoverPublicLinks(String text) {
        List<String> links = new ArrayList<>();
        var matcher = URL.matcher(text == null ? "" : text);
        while (matcher.find()) {
            String link = matcher.group().replaceAll("[.,;:]+$", "");
            if (!link.toLowerCase(Locale.ROOT).startsWith("http://")
                    && !link.toLowerCase(Locale.ROOT).startsWith("https://")) {
                link = "https://" + link;
            }
            if (!links.contains(link)) links.add(link);
        }
        return links.stream().limit(25).toList();
    }

    private List<String> discoveredUsernames(String text, List<String> links) {
        List<String> usernames = new ArrayList<>();
        var handleMatcher = HANDLE.matcher(defaulted(text, ""));
        while (handleMatcher.find()) addUnique(usernames, handleMatcher.group(1));
        for (String link : links) {
            var githubMatcher = GITHUB_URL.matcher(link);
            if (githubMatcher.find()) addUnique(usernames, githubMatcher.group(1));
        }
        return usernames.stream().limit(25).toList();
    }

    private List<List<String>> claims(String cvText, List<String> requirements, List<String> techTerms) {
        List<List<String>> rows = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String normalizedCv = normalize(cvText);
        String normalizedRequirements = normalize(String.join(" ", requirements));
        for (String requirement : requirements) {
            String status = requirementStatus(requirement, normalizedCv, techTerms);
            String reason = "Supported".equals(status)
                    ? "The CV mentions multiple terms aligned with this requirement."
                    : "Stretched".equals(status)
                    ? "The CV partially overlaps this requirement."
                    : "The CV does not clearly mention this requirement.";
            addClaim(rows, seen, requirement, status, reason);
        }
        for (String sentence : SENTENCE.split(defaulted(cvText, ""))) {
            String clean = sentence.trim();
            if (clean.length() < 18) continue;
            String lower = normalize(clean);
            boolean risky = atsKeywordCatalog.riskyWords().stream().anyMatch(lower::contains);
            int requirementHits = keywordHits(clean, normalizedRequirements);
            if (risky) {
                addClaim(rows, seen, clean, "Stretched",
                        "The wording raises the proof burden.");
            } else if (requirementHits >= 2) {
                addClaim(rows, seen, clean, "Supported",
                        "This CV sentence overlaps multiple job terms.");
            } else if (hasConcreteTechnicalSignal(lower, techTerms)) {
                addClaim(rows, seen, clean, "Supported",
                        "This CV sentence contains a concrete technical statement.");
            } else if (requirementHits == 1) {
                addClaim(rows, seen, clean, "Stretched",
                        "This CV sentence has partial job overlap.");
            } else if (isNeutralCvLine(clean)) {
                addClaim(rows, seen, clean, "Gap", "This CV line is neutral context.");
            } else {
                addClaim(rows, seen, clean, "Gap",
                        "This CV sentence does not contain concrete job-specific evidence.");
            }
        }
        if (rows.isEmpty()) {
            addClaim(rows, seen, "Candidate CV", "Unsupported", "No readable CV text was available.");
        }
        return rows.stream().limit(120).toList();
    }

    private void addClaim(List<List<String>> rows, Set<String> seen, String text, String status, String reason) {
        String normalized = normalize(text);
        if (normalized.length() < 6 || seen.contains(normalized)) return;
        seen.add(normalized);
        rows.add(List.of(text, status, reason));
    }

    private String normalize(String text) {
        if (text == null) return "";
        return text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9@./#-]+", " ").trim();
    }

    private int keywordHits(String sentence, String normalizedRequirements) {
        if (sentence == null || sentence.isBlank()) return 0;
        String lower = sentence.toLowerCase(Locale.ROOT);
        int hits = 0;
        for (String word : REQUIREMENT_SECTIONS) {
            if (lower.contains(word.toLowerCase(Locale.ROOT))) hits++;
        }
        return hits;
    }

    private String requirementStatus(String requirement, String normalizedCv, List<String> techTerms) {
        String normalized = normalize(requirement);
        if (normalized.isBlank()) return "Gap";
        int hits = 0;
        for (String term : normalized.split("\\s+")) {
            if (term.length() <= 2) continue;
            if (normalizedCv.contains(term)) hits++;
        }
        if (hits >= 3) return "Supported";
        if (hits >= 1) {
            boolean hasTechTerm = techTerms.stream().anyMatch(term ->
                    normalized.contains(term) && normalizedCv.contains(term));
            return hasTechTerm ? "Supported" : "Stretched";
        }
        return "Unsupported";
    }

    private int requirementMatch(List<String> requirements, String cvText, List<String> techTerms) {
        if (requirements.isEmpty() || cvText == null || cvText.isBlank()) return 50;
        String normalizedCv = normalize(cvText);
        int total = 0;
        int matched = 0;
        for (String req : requirements) {
            String normalized = normalize(req);
            if (normalized.isBlank()) continue;
            total++;
            for (String word : normalized.split("\\s+")) {
                if (word.length() <= 2 || STOP_WORDS.contains(word)) continue;
                if (normalizedCv.contains(word)) {
                    matched++;
                    break;
                }
            }
        }
        List<String> cvTerms = new ArrayList<>();
        for (String term : techTerms) {
            if (normalizedCv.contains(term)) cvTerms.add(term);
        }
        int techBonus = Math.min(15, cvTerms.size() * 2);
        return total == 0 ? 50 + techBonus : Math.min(98, Math.round((float) matched / total * 85) + techBonus);
    }

    private boolean hasConcreteTechnicalSignal(String lower, List<String> techTerms) {
        return techTerms.stream().anyMatch(lower::contains);
    }

    private boolean isNeutralCvLine(String line) {
        String lower = line.toLowerCase(Locale.ROOT);
        return lower.startsWith("summary") || lower.startsWith("profile") || lower.startsWith("objective")
                || lower.startsWith("contact") || lower.startsWith("phone:") || lower.startsWith("email:")
                || lower.length() < 25;
    }

    private List<Map<String, Object>> riskyMatches(HiringProject project, String cvText) {
        List<String> riskyWords = analysisRiskyWords(project);
        List<Map<String, Object>> matches = new ArrayList<>();
        if (cvText == null || cvText.isBlank()) return matches;
        String lower = cvText.toLowerCase(Locale.ROOT);
        for (String word : riskyWords) {
            int index = lower.indexOf(word);
            if (index >= 0) {
                int start = Math.max(0, index - 40);
                int end = Math.min(cvText.length(), index + word.length() + 60);
                matches.add(Map.of(
                        "phrase", word,
                        "context", cvText.substring(start, end).replaceAll("\\R+", " ").trim(),
                        "position", index
                ));
            }
        }
        return matches;
    }

    private String summary(HiringCandidate candidate, HiringProject project) {
        int score = candidate.getScore();
        int supported = candidate.getSupported();
        int stretched = candidate.getStretched();
        int unsupported = candidate.getUnsupported();
        int total = Math.max(1, supported + stretched + unsupported);
        return String.format(
                "Score %d/100 — %d supported, %d stretched, %d unsupported claims out of %d analyzed for %s.",
                score, supported, stretched, unsupported, total, project.getTitle());
    }

    public List<HiringCandidate> priorApplications(HiringProject project, String name, String email,
                                                    Long excludedCandidateId) {
        if (project.getOrganization() == null) return List.of();
        return candidateRepository.findPriorApplications(
                        project.getOrganization().getId(),
                        defaulted(name, ""),
                        defaulted(email, ""),
                        new OffsetLimitPageable(0, 6, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream()
                .filter(c -> excludedCandidateId == null || !excludedCandidateId.equals(c.getId()))
                .limit(5)
                .toList();
    }

    private String memoryStatus(List<HiringCandidate> priorApplications, int unsupported) {
        if (priorApplications.isEmpty()) return "No prior record";
        boolean mismatch = priorApplications.stream()
                .anyMatch(prior -> "High".equalsIgnoreCase(prior.getRisk())
                        || Math.abs(prior.getUnsupported() - unsupported) >= 2);
        return mismatch ? "Previous mismatch" : "Returning candidate";
    }

    private String extractCandidateEmail(String cvText) {
        var matcher = EMAIL.matcher(defaulted(cvText, ""));
        return matcher.find() ? matcher.group(1).toLowerCase(Locale.ROOT) : "";
    }

    private void addUnique(List<String> values, String value) {
        String clean = defaulted(value, "").replaceAll("^[^a-zA-Z0-9]+|[^a-zA-Z0-9_-]+$", "");
        if (!clean.isBlank() && !values.contains(clean)) values.add(clean);
    }

    private List<String> splitLines(String text) {
        if (text == null || text.isBlank()) return List.of();
        return List.of(text.split("\\R"));
    }

    private List<String> analysisTechTerms(HiringProject project) {
        LinkedHashMap<String, String> terms = new LinkedHashMap<>();
        atsKeywordCatalog.techTerms().forEach(term ->
                terms.putIfAbsent(term.toLowerCase(Locale.ROOT), term.toLowerCase(Locale.ROOT)));
        projectStateService.activeAnalysisTemplate(project).techTerms()
                .forEach(term -> terms.putIfAbsent(term.toLowerCase(Locale.ROOT), term.toLowerCase(Locale.ROOT)));
        return List.copyOf(terms.values());
    }

    private List<String> analysisRiskyWords(HiringProject project) {
        LinkedHashMap<String, String> terms = new LinkedHashMap<>();
        atsKeywordCatalog.riskyWords().forEach(term ->
                terms.putIfAbsent(term.toLowerCase(Locale.ROOT), term.toLowerCase(Locale.ROOT)));
        projectStateService.activeAnalysisTemplate(project).riskyWords()
                .forEach(term -> terms.putIfAbsent(term.toLowerCase(Locale.ROOT), term.toLowerCase(Locale.ROOT)));
        return List.copyOf(terms.values());
    }

    private List<String> weightedRubricRequirements(HiringProject project, List<String> requirements) {
        return requirements;
    }

    private CandidateAnalysisPolicy analysisPolicy(String state) {
        return switch (normalizeAnalysisState(state)) {
            case CheckStateIds.LIGHT -> new CandidateAnalysisPolicy(72, 1, 0, 0, 3, 1, 16, 8, 35, 4, 62, 5);
            case CheckStateIds.WAR -> new CandidateAnalysisPolicy(52, 2, 1, 1, 7, 3, 16, 15, 52, 2, 76, 2);
            case CheckStateIds.PERSON -> new CandidateAnalysisPolicy(64, 1, 1, 1, 5, 2, 20, 12, 44, 3, 70, 3);
            case CheckStateIds.STRICT_WAR_AI -> new CandidateAnalysisPolicy(45, 3, 1, 2, 8, 3, 14, 18, 58, 2, 80, 2);
            default -> throw new IllegalArgumentException("Unsupported candidate analysis state");
        };
    }

    private record CandidateAnalysisPolicy(
            int stretchedMatchWeight, int unsupportedFlagWeight, int stretchedFlagWeight, int riskyPhraseWeight,
            int unsupportedScorePenalty, int stretchedScorePenalty, int positiveEvidenceCap, int flagPenaltyCap,
            int highRiskScore, int highRiskUnsupported, int mediumRiskScore, int mediumRiskStretched) {
    }

    private HiringCandidate candidateEntity(UserAccount owner, Long projectId, Long candidateId) {
        return candidateRepository.findAccessibleById(candidateId, projectId, owner.getId(), owner.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found"));
    }

    private void saveClaims(HiringCandidate candidate, CandidateAnalysisRun run) {
        claimRepository.deleteByCandidateId(candidate.getId());
        List<List<String>> claims = mapper.read(candidate.getClaimsJson(),
                new com.fasterxml.jackson.core.type.TypeReference<List<List<String>>>() {}, List.of());
        if (claims.isEmpty()) return;
        List<CandidateClaim> entities = new ArrayList<>();
        for (int index = 0; index < claims.size(); index++) {
            List<String> row = claims.get(index);
            if (row == null || row.size() < 2) continue;
            CandidateClaim claim = new CandidateClaim();
            claim.setCandidate(candidate);
            claim.setClaimText(row.get(0));
            claim.setStatus(row.get(1));
            claim.setReason(row.size() > 2 ? row.get(2) : null);
            claim.setSentenceIndex(index);
            claim.setAnalysisRun(run);
            entities.add(claim);
        }
        claimRepository.saveAll(entities);
    }

    private String defaulted(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
