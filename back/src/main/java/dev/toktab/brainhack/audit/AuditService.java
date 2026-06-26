package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.CheckStateResponse;
import dev.toktab.brainhack.events.RabbitEventPublisher;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private static final String LOCAL_ANALYZER_VERSION = "local-heuristic-v2";
    private static final String LLM_PROMPT_VERSION = "verdict-claim-audit-v1";

    private final AuditRepository auditRepository;
    private final SentenceSplitter sentenceSplitter;
    private final LlmAuditAnalyzer llmAuditAnalyzer;
    private final LocalAuditAnalyzer localAuditAnalyzer;
    private final ScoringService scoringService;
    private final FingerprintService fingerprintService;
    private final RabbitEventPublisher rabbitEventPublisher;
    private final AuditLogService logService;
    private final TaskExecutor auditTaskExecutor;
    private final AuditTemplateService templateService;
    private final CheckStateService checkStateService;
    private final int maxClaimChars;
    private final int maxEvidenceChars;

    public AuditService(
            AuditRepository auditRepository,
            SentenceSplitter sentenceSplitter,
            LlmAuditAnalyzer llmAuditAnalyzer,
            LocalAuditAnalyzer localAuditAnalyzer,
            ScoringService scoringService,
            FingerprintService fingerprintService,
            RabbitEventPublisher rabbitEventPublisher,
            AuditLogService logService,
            @Qualifier("auditTaskExecutor")
            TaskExecutor auditTaskExecutor,
            AuditTemplateService templateService,
            CheckStateService checkStateService,
            @Value("${verdict.audit.max-claim-chars}") int maxClaimChars,
            @Value("${verdict.audit.max-evidence-chars}") int maxEvidenceChars) {
        this.auditRepository = auditRepository;
        this.sentenceSplitter = sentenceSplitter;
        this.llmAuditAnalyzer = llmAuditAnalyzer;
        this.localAuditAnalyzer = localAuditAnalyzer;
        this.scoringService = scoringService;
        this.fingerprintService = fingerprintService;
        this.rabbitEventPublisher = rabbitEventPublisher;
        this.logService = logService;
        this.auditTaskExecutor = auditTaskExecutor;
        this.templateService = templateService;
        this.checkStateService = checkStateService;
        this.maxClaimChars = maxClaimChars;
        this.maxEvidenceChars = maxEvidenceChars;
    }

    public Audit run(AuditRunRequest request, HttpServletRequest httpRequest) {
        return run(request, httpRequest, null);
    }

    public Audit run(AuditRunRequest request, HttpServletRequest httpRequest, UserAccount owner) {
        long started = System.currentTimeMillis();
        String claimText = trim(request.claimText(), maxClaimChars);
        String evidenceText = trim(request.evidenceText(), maxEvidenceChars);
        List<String> sentences = sentenceSplitter.split(claimText);
        if (sentences.isEmpty()) {
            throw new IllegalArgumentException("Claim document does not contain auditable text.");
        }
        rabbitEventPublisher.publish("audit.requested", Map.of("claimTitle", title(request.claimTitle(), "Claim Document"), "sentenceCount", sentences.size()));
        Audit audit = new Audit();
        audit.setClaimTitle(title(request.claimTitle(), "Claim Document"));
        audit.setEvidenceTitle(title(request.evidenceTitle(), "Evidence Document"));
        audit.setClaimText(claimText);
        audit.setEvidenceText(evidenceText);
        audit.setClaimFingerprint(fingerprintService.sha256(claimText));
        audit.setEvidenceFingerprint(fingerprintService.sha256(evidenceText));
        audit.setEngine("pending");
        audit.setAnalyzerVersion(analyzerVersionFor(request.checkStateId()));
        audit.setPromptVersion(promptVersionFor(request.checkStateId()));
        audit.setStatus(AuditStatus.RUNNING);
        audit.setOwner(owner);
        applyTemplate(audit, owner, request.templateId());
        applyCheckState(audit, request.checkStateId());
        enforceWarWeeklyLimit(owner, audit.getCheckStateId());
        audit = auditRepository.saveAndFlush(audit);
        try {
            AuditAnalysisResult analysis = analyze(audit, sentences, evidenceText);
            List<AnalyzedVerdict> normalizedVerdicts = normalizeEvidencePointers(applyUnimportantRules(audit, analysis.verdicts()), evidenceText);
            audit.setEngine(analysis.engine());
            audit.setCredibilityScore(scoringService.score(normalizedVerdicts));
            audit.setProcessingMillis(System.currentTimeMillis() - started);
            for (AnalyzedVerdict analyzed : normalizedVerdicts) {
                audit.addVerdict(toEntity(analyzed));
            }
            countStatuses(audit);
            audit.setStatus(AuditStatus.COMPLETED);
            Audit saved = auditRepository.save(audit);
            rabbitEventPublisher.publish("audit.completed", Map.of("auditId", saved.getId(), "score", saved.getCredibilityScore(), "engine", saved.getEngine()));
            String actor = owner == null ? "visitor" : owner.getUsername();
            logService.record("AUDIT_RUN", httpRequest, 200, saved.getProcessingMillis(), actor, "auditId=" + saved.getId() + "; status=" + saved.getStatus() + "; score=" + saved.getCredibilityScore() + "; engine=" + saved.getEngine());
            return saved;
        } catch (RuntimeException exception) {
            audit.setStatus(AuditStatus.FAILED);
            audit.setProcessingMillis(System.currentTimeMillis() - started);
            auditRepository.save(audit);
            rabbitEventPublisher.publish("audit.failed", Map.of("auditId", audit.getId(), "error", exception.getClass().getSimpleName()));
            throw exception;
        }
    }

    public Audit startAsync(AuditRunRequest request, UserAccount owner) {
        Audit audit = createRunningAudit(request, owner);
        auditTaskExecutor.execute(() -> completeAsync(audit.getId()));
        return audit;
    }

    public Audit get(Long id) {
        return auditRepository.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> new IllegalArgumentException("Audit not found: " + id));
    }

    public Audit getForUser(Long id, UserAccount owner) {
        return auditRepository.findByIdAndOwnerIdAndDeletedAtIsNull(id, owner.getId()).orElseThrow(() -> new IllegalArgumentException("Audit not found: " + id));
    }

    public List<Audit> history() {
        return auditRepository.findByDeletedAtIsNullOrderByCreatedAtDesc();
    }

    public List<Audit> history(String search) {
        String needle = trim(search, 500).toLowerCase(Locale.ROOT);
        return history().stream()
                .filter(audit -> needle.isBlank() || contains(audit.getClaimTitle(), needle)
                        || contains(audit.getEvidenceTitle(), needle)
                        || contains(audit.getEngine(), needle)
                        || contains(audit.getStatus().name(), needle)
                        || contains(audit.getTemplateName(), needle))
                .toList();
    }

    public List<Audit> historyForUser(UserAccount owner) {
        return auditRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner.getId());
    }

    @Transactional
    public void delete(Long id) {
        Audit audit = get(id);
        audit.setDeletedAt(Instant.now());
        auditRepository.save(audit);
    }

    @Transactional
    public Audit recalculate(Long id) {
        Audit audit = get(id);
        List<AnalyzedVerdict> analyzed = audit.getVerdicts().stream()
                .map(verdict -> new AnalyzedVerdict(
                        verdict.getSentenceIndex(),
                        verdict.getSentence(),
                        verdict.getStatus(),
                        verdict.getConfidence(),
                        verdict.getReasonCategory(),
                        verdict.getExplanation(),
                        verdict.getEvidencePointer()))
                .toList();
        audit.setCredibilityScore(scoringService.score(analyzed));
        countStatuses(audit);
        return auditRepository.save(audit);
    }

    private AuditAnalysisResult analyze(Audit audit, List<String> sentences, String evidenceText) {
        String stateId = audit.getCheckStateId() == null ? "war" : audit.getCheckStateId();
        return switch (stateId) {
            case "person" -> llmOrLocal(sentences, evidenceText, "PERSON_STATE_LLM_FALLBACK");
            case "strict-war-ai" -> strictWarAi(sentences, evidenceText);
            case "light" -> lightLocal(sentences, evidenceText);
            default -> localAuditAnalyzer.analyze(sentences, evidenceText);
        };
    }

    private AuditAnalysisResult llmOrLocal(List<String> sentences, String evidenceText, String fallbackEvent) {
        if (!llmAuditAnalyzer.configured()) {
            return localWithEngine(sentences, evidenceText, "LOCAL_HEURISTIC_NO_LLM");
        }
        try {
            return llmAuditAnalyzer.analyze(sentences, evidenceText);
        } catch (RuntimeException exception) {
            logService.recordSystem(fallbackEvent, exception.getMessage());
            return localWithEngine(sentences, evidenceText, "LOCAL_HEURISTIC_LLM_FALLBACK");
        }
    }

    private AuditAnalysisResult strictWarAi(List<String> sentences, String evidenceText) {
        AuditAnalysisResult local = localAuditAnalyzer.analyze(sentences, evidenceText);
        if (!llmAuditAnalyzer.configured()) {
            return new AuditAnalysisResult("LOCAL_HEURISTIC_STRICT_NO_LLM", local.verdicts());
        }
        try {
            AuditAnalysisResult llm = llmAuditAnalyzer.analyze(sentences, evidenceText);
            return new AuditAnalysisResult(local.engine() + "+" + llm.engine(), combineStrict(local.verdicts(), llm.verdicts()));
        } catch (RuntimeException exception) {
            logService.recordSystem("STRICT_WAR_AI_LLM_FALLBACK", exception.getMessage());
            return new AuditAnalysisResult("LOCAL_HEURISTIC_STRICT_LLM_FALLBACK", local.verdicts());
        }
    }

    private AuditAnalysisResult lightLocal(List<String> sentences, String evidenceText) {
        AuditAnalysisResult local = localAuditAnalyzer.analyze(sentences, evidenceText);
        List<AnalyzedVerdict> lightVerdicts = local.verdicts().stream()
                .map(verdict -> verdict.status() == VerdictStatus.UNSUPPORTED && verdict.confidence() != Confidence.HIGH
                        ? new AnalyzedVerdict(
                        verdict.sentenceIndex(),
                        verdict.sentence(),
                        VerdictStatus.STRETCHED,
                        Confidence.LOW,
                        "light review",
                        "Light-State treats this as a weak or partially supported issue instead of a hard unsupported claim.",
                        verdict.evidencePointer())
                        : verdict)
                .toList();
        return new AuditAnalysisResult("LOCAL_HEURISTIC_LIGHT", lightVerdicts);
    }

    private AuditAnalysisResult localWithEngine(List<String> sentences, String evidenceText, String engine) {
        return new AuditAnalysisResult(engine, localAuditAnalyzer.analyze(sentences, evidenceText).verdicts());
    }

    private List<AnalyzedVerdict> combineStrict(List<AnalyzedVerdict> local, List<AnalyzedVerdict> llm) {
        return local.stream()
                .map(localVerdict -> stricter(localVerdict, llm.stream()
                        .filter(row -> row.sentenceIndex() == localVerdict.sentenceIndex())
                        .findFirst()
                        .orElse(localVerdict)))
                .toList();
    }

    private AnalyzedVerdict stricter(AnalyzedVerdict local, AnalyzedVerdict llm) {
        AnalyzedVerdict selected = severity(llm.status()) > severity(local.status()) ? llm : local;
        if (selected == local && severity(local.status()) == severity(llm.status())) {
            selected = confidenceSeverity(llm.confidence()) > confidenceSeverity(local.confidence()) ? llm : local;
        }
        if (selected == local) {
            return new AnalyzedVerdict(
                    local.sentenceIndex(),
                    local.sentence(),
                    local.status(),
                    local.confidence(),
                    "strict local + ai",
                    local.explanation() + " AI cross-check: " + llm.explanation(),
                    local.evidencePointer());
        }
        return new AnalyzedVerdict(
                selected.sentenceIndex(),
                selected.sentence(),
                selected.status(),
                selected.confidence(),
                "strict local + ai",
                "Local WAR: " + local.explanation() + " AI cross-check: " + llm.explanation(),
                selected.evidencePointer());
    }

    private int severity(VerdictStatus status) {
        return switch (status) {
            case UNSUPPORTED -> 5;
            case GAP -> 4;
            case STRETCHED -> 3;
            case SUPPORTED -> 2;
            case NOT_A_CLAIM -> 1;
        };
    }

    private int confidenceSeverity(Confidence confidence) {
        return switch (confidence) {
            case HIGH -> 3;
            case MEDIUM -> 2;
            case LOW -> 1;
        };
    }

    private void applyTemplate(Audit audit, UserAccount owner, String templateId) {
        if (owner == null) {
            return;
        }
        AuditTemplateService.SelectedAuditTemplate template = templateService.select(owner, templateId);
        audit.setTemplateId(template.id());
        audit.setTemplateName(template.name());
        audit.setTemplateDescription(template.description());
        audit.setTemplateInstructions(template.instructions());
        audit.setTemplateMarkUnimportant(String.join("\n", template.markUnimportant()));
    }

    private void applyCheckState(Audit audit, String checkStateId) {
        CheckStateResponse state = checkStateService.select(checkStateId);
        audit.setCheckStateId(state.id());
        audit.setCheckStateName(state.name());
        audit.setCheckStateDescription(state.description());
    }

    private List<AnalyzedVerdict> applyUnimportantRules(Audit audit, List<AnalyzedVerdict> verdicts) {
        List<String> rules = splitRules(audit.getTemplateMarkUnimportant());
        return verdicts.stream()
                .map(verdict -> isUnimportant(verdict.sentence(), rules)
                        ? new AnalyzedVerdict(
                        verdict.sentenceIndex(),
                        verdict.sentence(),
                        VerdictStatus.NOT_A_CLAIM,
                        Confidence.HIGH,
                        "template unimportant",
                        "The selected template marks this contact, identity, link, or metadata text as unimportant context rather than an auditable claim.",
                        "No evidence required.")
                        : verdict)
                .toList();
    }

    private List<String> splitRules(String rules) {
        return List.of((rules == null ? "" : rules).split("[,\\n]")).stream()
                .map(String::trim)
                .filter(rule -> !rule.isBlank())
                .map(rule -> rule.toLowerCase(Locale.ROOT))
                .toList();
    }

    private boolean isUnimportant(String sentence, List<String> rules) {
        String normalized = sentence.toLowerCase(Locale.ROOT);
        if (normalized.matches(".*[\\w.%+-]+@[\\w.-]+\\.[a-z]{2,}.*")
                || normalized.matches(".*https?://\\S+.*")
                || normalized.matches(".*\\b(linkedin|github|portfolio)\\.com\\S*.*")
                || normalized.matches("^[+\\d ()-]{7,}$")) {
            return true;
        }
        return rules.stream().anyMatch(normalized::contains);
    }

    private Audit createRunningAudit(AuditRunRequest request, UserAccount owner) {
        String claimText = trim(request.claimText(), maxClaimChars);
        String evidenceText = trim(request.evidenceText(), maxEvidenceChars);
        if (sentenceSplitter.split(claimText).isEmpty()) {
            throw new IllegalArgumentException("Claim document does not contain auditable text.");
        }
        Audit audit = new Audit();
        audit.setClaimTitle(title(request.claimTitle(), "Claim Document"));
        audit.setEvidenceTitle(title(request.evidenceTitle(), "Evidence Document"));
        audit.setClaimText(claimText);
        audit.setEvidenceText(evidenceText);
        audit.setClaimFingerprint(fingerprintService.sha256(claimText));
        audit.setEvidenceFingerprint(fingerprintService.sha256(evidenceText));
        audit.setEngine("queued");
        audit.setAnalyzerVersion(analyzerVersionFor(request.checkStateId()));
        audit.setPromptVersion(promptVersionFor(request.checkStateId()));
        audit.setStatus(AuditStatus.RUNNING);
        audit.setOwner(owner);
        applyTemplate(audit, owner, request.templateId());
        applyCheckState(audit, request.checkStateId());
        enforceWarWeeklyLimit(owner, audit.getCheckStateId());
        Audit saved = auditRepository.saveAndFlush(audit);
        rabbitEventPublisher.publish("audit.requested", Map.of("auditId", saved.getId(), "claimTitle", saved.getClaimTitle()));
        return saved;
    }

    private void enforceWarWeeklyLimit(UserAccount owner, String checkStateId) {
        if (owner == null || !"war".equals(checkStateId)) {
            return;
        }
        Instant weekStart = Instant.now().minus(Duration.ofDays(7));
        long used = auditRepository.countByOwnerIdAndCheckStateIdAndCreatedAtAfterAndDeletedAtIsNull(owner.getId(), "war", weekStart);
        if (used >= 5) {
            throw new IllegalArgumentException("WAR-State can be used 5 times per week for a single account.");
        }
    }

    private void completeAsync(Long auditId) {
        long started = System.currentTimeMillis();
        Audit audit = auditRepository.findByIdAndDeletedAtIsNull(auditId).orElse(null);
        if (audit == null) {
            return;
        }
        try {
            List<String> sentences = sentenceSplitter.split(audit.getClaimText());
            AuditAnalysisResult analysis = analyze(audit, sentences, audit.getEvidenceText());
            List<AnalyzedVerdict> normalizedVerdicts = normalizeEvidencePointers(applyUnimportantRules(audit, analysis.verdicts()), audit.getEvidenceText());
            audit.setEngine(analysis.engine());
            audit.setCredibilityScore(scoringService.score(normalizedVerdicts));
            audit.setProcessingMillis(System.currentTimeMillis() - started);
            audit.getVerdicts().clear();
            for (AnalyzedVerdict analyzed : normalizedVerdicts) {
                audit.addVerdict(toEntity(analyzed));
            }
            countStatuses(audit);
            audit.setStatus(AuditStatus.COMPLETED);
            Audit saved = auditRepository.save(audit);
            rabbitEventPublisher.publish("audit.completed", Map.of("auditId", saved.getId(), "score", saved.getCredibilityScore(), "engine", saved.getEngine()));
            logService.recordSystem("AUDIT_ASYNC_COMPLETED", "auditId=" + saved.getId() + "; score=" + saved.getCredibilityScore() + "; engine=" + saved.getEngine());
        } catch (RuntimeException exception) {
            audit.setStatus(AuditStatus.FAILED);
            audit.setProcessingMillis(System.currentTimeMillis() - started);
            auditRepository.save(audit);
            rabbitEventPublisher.publish("audit.failed", Map.of("auditId", audit.getId(), "error", exception.getClass().getSimpleName()));
            logService.recordSystem("AUDIT_ASYNC_FAILED", "auditId=" + audit.getId() + "; error=" + exception.getClass().getSimpleName());
        }
    }

    private String analyzerVersionFor(String checkStateId) {
        if ("person".equals(checkStateId)) {
            return "llm-preferred-v1";
        }
        if ("strict-war-ai".equals(checkStateId)) {
            return LOCAL_ANALYZER_VERSION + "+llm-crosscheck-v1";
        }
        if ("light".equals(checkStateId)) {
            return "local-light-v1";
        }
        return LOCAL_ANALYZER_VERSION;
    }

    private String promptVersionFor(String checkStateId) {
        if ("person".equals(checkStateId) || "strict-war-ai".equals(checkStateId)) {
            return LLM_PROMPT_VERSION;
        }
        return "none-local-deterministic";
    }

    private List<AnalyzedVerdict> normalizeEvidencePointers(List<AnalyzedVerdict> verdicts, String evidenceText) {
        return verdicts.stream()
                .map(verdict -> new AnalyzedVerdict(
                        verdict.sentenceIndex(),
                        verdict.sentence(),
                        verdict.status(),
                        verdict.confidence(),
                        verdict.reasonCategory(),
                        verdict.explanation(),
                        normalizeEvidencePointer(verdict, evidenceText)))
                .toList();
    }

    private String normalizeEvidencePointer(AnalyzedVerdict verdict, String evidenceText) {
        if (verdict.status() == VerdictStatus.UNSUPPORTED) {
            return "No evidence found.";
        }
        String pointer = verdict.evidencePointer();
        if (pointer != null && evidenceText.toLowerCase(Locale.ROOT).contains(pointer.toLowerCase(Locale.ROOT))) {
            return pointer;
        }
        String sentence = verdict.sentence();
        String fallback = bestEvidenceSnippet(sentence, evidenceText);
        if (!fallback.isBlank()) {
            return fallback;
        }
        return pointer == null || pointer.isBlank() ? "No exact evidence pointer found." : pointer;
    }

    private String bestEvidenceSnippet(String sentence, String evidenceText) {
        String[] words = sentence.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 ]", " ").split("\\s+");
        String[] chunks = evidenceText.split("(?<=[.!?])\\s+|\\n+");
        String best = "";
        int bestScore = 0;
        for (String chunk : chunks) {
            String lower = chunk.toLowerCase(Locale.ROOT);
            int score = 0;
            for (String word : words) {
                if (word.length() >= 4 && lower.contains(word)) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                best = chunk.trim();
            }
        }
        return bestScore >= 2 ? best : "";
    }

    private Verdict toEntity(AnalyzedVerdict analyzed) {
        Verdict verdict = new Verdict();
        verdict.setSentenceIndex(analyzed.sentenceIndex());
        verdict.setSentence(analyzed.sentence());
        verdict.setStatus(analyzed.status());
        verdict.setConfidence(analyzed.confidence());
        verdict.setReasonCategory(analyzed.reasonCategory());
        verdict.setExplanation(analyzed.explanation());
        verdict.setEvidencePointer(analyzed.evidencePointer());
        return verdict;
    }

    private void countStatuses(Audit audit) {
        audit.setSupportedCount(count(audit, VerdictStatus.SUPPORTED));
        audit.setStretchedCount(count(audit, VerdictStatus.STRETCHED));
        audit.setUnsupportedCount(count(audit, VerdictStatus.UNSUPPORTED));
        audit.setNotClaimCount(count(audit, VerdictStatus.NOT_A_CLAIM));
        audit.setGapCount(count(audit, VerdictStatus.GAP));
    }

    private int count(Audit audit, VerdictStatus status) {
        return (int) audit.getVerdicts().stream().filter(v -> v.getStatus() == status).count();
    }

    private String trim(String text, int max) {
        String value = text == null ? "" : text.trim();
        return value.length() <= max ? value : value.substring(0, max);
    }

    private boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private String title(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }
}
