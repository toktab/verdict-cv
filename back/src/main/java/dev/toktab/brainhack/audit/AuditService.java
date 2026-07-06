package dev.toktab.brainhack.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.AuditSnapshotResponse;
import dev.toktab.brainhack.api.dto.CheckStateResponse;
import dev.toktab.brainhack.api.dto.VerdictOverrideRequest;
import dev.toktab.brainhack.events.RabbitEventPublisher;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.web.client.RestClientException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.TaskExecutor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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
    private final AuditJobDispatcher auditJobDispatcher;
    private final AuditLogService logService;
    private final TaskExecutor auditTaskExecutor;
    private final AuditTemplateService templateService;
    private final CheckStateService checkStateService;
    private final VerdictRepository verdictRepository;
    private final VerdictOverrideRepository overrideRepository;
    private final AuditSnapshotRepository snapshotRepository;
    private final ObjectMapper objectMapper;
    private final ConcurrentMap<Long, Object> warQuotaLocks = new ConcurrentHashMap<>();
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
            AuditJobDispatcher auditJobDispatcher,
            AuditLogService logService,
            @Qualifier("auditTaskExecutor")
            TaskExecutor auditTaskExecutor,
            AuditTemplateService templateService,
            CheckStateService checkStateService,
            VerdictRepository verdictRepository,
            VerdictOverrideRepository overrideRepository,
            AuditSnapshotRepository snapshotRepository,
            ObjectMapper objectMapper,
            @Value("${verdict.audit.max-claim-chars}") int maxClaimChars,
            @Value("${verdict.audit.max-evidence-chars}") int maxEvidenceChars) {
        this.auditRepository = auditRepository;
        this.sentenceSplitter = sentenceSplitter;
        this.llmAuditAnalyzer = llmAuditAnalyzer;
        this.localAuditAnalyzer = localAuditAnalyzer;
        this.scoringService = scoringService;
        this.fingerprintService = fingerprintService;
        this.rabbitEventPublisher = rabbitEventPublisher;
        this.auditJobDispatcher = auditJobDispatcher;
        this.logService = logService;
        this.auditTaskExecutor = auditTaskExecutor;
        this.templateService = templateService;
        this.checkStateService = checkStateService;
        this.verdictRepository = verdictRepository;
        this.overrideRepository = overrideRepository;
        this.snapshotRepository = snapshotRepository;
        this.objectMapper = objectMapper;
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
        clearFailure(audit);
        Instant now = Instant.now();
        audit.setQueuedAt(now);
        audit.setStartedAt(now);
        audit.setLastWorkerHeartbeatAt(now);
        audit.setJobAttempts(1);
        setProgress(audit, "analyzing", 20, "Analyzing claim sentences.");
        audit.setOwner(owner);
        applyTemplate(audit, owner, request.templateId(), request.auditMode());
        applyCheckState(audit, request.checkStateId());
        audit = saveNewAuditWithQuota(audit, owner);
        try {
            AuditAnalysisResult analysis = analyze(audit, sentences, evidenceText);
            Audit saved = completeAnalyzedAudit(audit, analysis, evidenceText, started, false);
            String actor = owner == null ? "visitor" : owner.getUsername();
            logService.record("AUDIT_RUN", httpRequest, 200, saved.getProcessingMillis(), actor, "auditId=" + saved.getId() + "; status=" + saved.getStatus() + "; score=" + saved.getCredibilityScore() + "; engine=" + saved.getEngine());
            return saved;
        } catch (RuntimeException exception) {
            failAudit(audit, exception, started);
            throw exception;
        }
    }

    public Audit startAsync(AuditRunRequest request, UserAccount owner) {
        Audit audit = createRunningAudit(request, owner);
        dispatchAuditJob(audit.getId());
        return audit;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void recoverRunningAudits() {
        List<Audit> running = auditRepository.findByStatusAndDeletedAtIsNull(AuditStatus.RUNNING);
        for (Audit audit : running) {
            dispatchAuditJob(audit.getId());
        }
        if (!running.isEmpty()) {
            logService.recordSystem("AUDIT_ASYNC_RECOVERY", "requeued=" + running.size());
        }
    }

    public Audit get(Long id) {
        return auditRepository.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> new IllegalArgumentException("Audit not found: " + id));
    }

    public Audit getWithVerdicts(Long id) {
        return auditRepository.findWithVerdictsByIdAndDeletedAtIsNull(id).orElseThrow(() -> new IllegalArgumentException("Audit not found: " + id));
    }

    public Audit getForUser(Long id, UserAccount owner) {
        return auditRepository.findByIdAndOwnerIdAndDeletedAtIsNull(id, owner.getId()).orElseThrow(() -> new IllegalArgumentException("Audit not found: " + id));
    }

    public Audit getForUserWithVerdicts(Long id, UserAccount owner) {
        return auditRepository.findWithVerdictsByIdAndOwnerIdAndDeletedAtIsNull(id, owner.getId()).orElseThrow(() -> new IllegalArgumentException("Audit not found: " + id));
    }

    public List<Audit> history() {
        return auditRepository.findByDeletedAtIsNullOrderByCreatedAtDesc();
    }

    public List<Audit> history(String search) {
        return history(search, 0, 250);
    }

    public List<Audit> history(String search, int offset, int limit) {
        String needle = trim(search, 500);
        Pageable pageable = page(offset, limit);
        if (needle.isBlank()) {
            return auditRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable);
        }
        return auditRepository.search(needle, pageable);
    }

    public List<Audit> historyForUser(UserAccount owner) {
        return auditRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner.getId());
    }

    public List<Audit> historyForUser(UserAccount owner, int offset, int limit) {
        return auditRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner.getId(), page(offset, limit));
    }

    @Transactional
    public void delete(Long id) {
        Audit audit = get(id);
        audit.setDeletedAt(Instant.now());
        auditRepository.save(audit);
    }

    @Transactional
    public Audit cancel(Long id, UserAccount owner) {
        if (owner == null) {
            throw new IllegalArgumentException("User authentication required");
        }
        Audit audit = auditRepository.findByIdAndOwnerIdAndDeletedAtIsNullForUpdate(id, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Audit not found"));
        if (audit.getStatus() == AuditStatus.COMPLETED || audit.getStatus() == AuditStatus.FAILED || audit.getStatus() == AuditStatus.CANCELLED) {
            return audit;
        }
        audit.setCancellationRequested(true);
        audit.setStatus(AuditStatus.CANCELLED);
        clearFailure(audit);
        audit.setFinishedAt(Instant.now());
        audit.setLastWorkerHeartbeatAt(audit.getFinishedAt());
        setProgress(audit, "cancelled", 100, "Audit cancelled by user.");
        audit.setProcessingMillis(processingMillis(audit));
        Audit saved = auditRepository.save(audit);
        rabbitEventPublisher.publish("audit.cancelled", Map.of("auditId", saved.getId()));
        logService.recordSystem("AUDIT_CANCELLED", "auditId=" + saved.getId());
        return saved;
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

    @Transactional
    public Audit overrideVerdict(Long auditId, Long verdictId, UserAccount owner, VerdictOverrideRequest request) {
        Audit audit = getForUser(auditId, owner);
        Verdict verdict = audit.getVerdicts().stream()
                .filter(row -> row.getId().equals(verdictId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Verdict not found"));
        VerdictOverride override = new VerdictOverride();
        override.setVerdict(verdict);
        override.setAuthor(owner);
        override.setPreviousStatus(verdict.getStatus());
        override.setNewStatus(request.status());
        override.setReason(trim(request.reason(), 12000));
        overrideRepository.save(override);
        verdict.setStatus(request.status());
        verdict.setManualOverrideReason(trim(request.reason(), 120));
        verdict.setReasonCategory("manual override");
        verdict.setExplanation(verdict.getExplanation() + " Manual reviewer override: " + trim(request.reason(), 500));
        verdictRepository.save(verdict);
        countStatuses(audit);
        Audit saved = auditRepository.save(audit);
        snapshot(saved);
        return saved;
    }

    @Transactional
    public AuditSnapshotResponse latestSnapshot(Long auditId, UserAccount owner) {
        Audit audit = getForUser(auditId, owner);
        AuditSnapshot snapshot = snapshotRepository.findFirstByAuditIdOrderByCreatedAtDesc(audit.getId())
                .orElseThrow(() -> new IllegalArgumentException("Audit snapshot not found"));
        return new AuditSnapshotResponse(snapshot.getId(), audit.getId(), snapshot.getSnapshotFingerprint(), snapshot.getPayloadJson(), snapshot.getCreatedAt());
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
            return new AuditAnalysisResult(local.engine() + "+" + llm.engine(), combineStrict(local.verdicts(), llm.verdicts()), llm.usage());
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

    private void applyTemplate(Audit audit, UserAccount owner, String templateId, String auditMode) {
        if (owner == null) {
            return;
        }
        AuditTemplateService.SelectedAuditTemplate template = templateService.select(owner, templateId, auditMode);
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
        clearFailure(audit);
        audit.setQueuedAt(Instant.now());
        setProgress(audit, "queued", 0, "Queued for analysis.");
        audit.setOwner(owner);
        applyTemplate(audit, owner, request.templateId(), request.auditMode());
        applyCheckState(audit, request.checkStateId());
        Audit saved = saveNewAuditWithQuota(audit, owner);
        rabbitEventPublisher.publish("audit.requested", Map.of("auditId", saved.getId(), "claimTitle", saved.getClaimTitle()));
        return saved;
    }

    private Audit saveNewAuditWithQuota(Audit audit, UserAccount owner) {
        if (owner == null || !"war".equals(audit.getCheckStateId())) {
            return auditRepository.saveAndFlush(audit);
        }
        Object lock = warQuotaLocks.computeIfAbsent(owner.getId(), ignored -> new Object());
        synchronized (lock) {
            enforceWarWeeklyLimit(owner, audit.getCheckStateId());
            return auditRepository.saveAndFlush(audit);
        }
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
        if (cancelled(audit)) {
            markCancelled(audit);
            return;
        }
        try {
            audit.setJobAttempts(audit.getJobAttempts() + 1);
            audit.setStartedAt(Instant.now());
            audit.setLastWorkerHeartbeatAt(audit.getStartedAt());
            List<String> sentences = sentenceSplitter.split(audit.getClaimText());
            saveProgress(audit, "analyzing", 20, "Analyzing claim sentences.");
            AuditAnalysisResult analysis = analyze(audit, sentences, audit.getEvidenceText());
            if (cancelled(auditId)) {
                markCancelled(auditRepository.findByIdAndDeletedAtIsNull(auditId).orElse(audit));
                return;
            }
            Audit saved = completeAnalyzedAudit(audit, analysis, audit.getEvidenceText(), started, true);
            logService.recordSystem("AUDIT_ASYNC_COMPLETED", "auditId=" + saved.getId() + "; score=" + saved.getCredibilityScore() + "; engine=" + saved.getEngine());
        } catch (RuntimeException exception) {
            failAudit(audit, exception, started);
            logService.recordSystem("AUDIT_ASYNC_FAILED", "auditId=" + audit.getId() + "; error=" + exception.getClass().getSimpleName());
        }
    }

    public void completeQueued(Long auditId) {
        completeAsync(auditId);
    }

    private void dispatchAuditJob(Long auditId) {
        if (!auditJobDispatcher.dispatch(auditId)) {
            auditTaskExecutor.execute(() -> completeAsync(auditId));
        }
    }

    private boolean cancelled(Long auditId) {
        return auditRepository.findByIdAndDeletedAtIsNull(auditId)
                .map(this::cancelled)
                .orElse(true);
    }

    private boolean cancelled(Audit audit) {
        return audit.isCancellationRequested() || audit.getStatus() == AuditStatus.CANCELLED;
    }

    private void markCancelled(Audit audit) {
        audit.setCancellationRequested(true);
        audit.setStatus(AuditStatus.CANCELLED);
        clearFailure(audit);
        audit.setFinishedAt(Instant.now());
        audit.setLastWorkerHeartbeatAt(audit.getFinishedAt());
        setProgress(audit, "cancelled", 100, "Audit cancelled by user.");
        audit.setProcessingMillis(processingMillis(audit));
        auditRepository.save(audit);
        rabbitEventPublisher.publish("audit.cancelled", Map.of("auditId", audit.getId()));
        logService.recordSystem("AUDIT_ASYNC_CANCELLED", "auditId=" + audit.getId());
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

    private Audit completeAnalyzedAudit(Audit audit, AuditAnalysisResult analysis, String evidenceText, long started, boolean replaceVerdicts) {
        List<AnalyzedVerdict> normalizedVerdicts = normalizeEvidencePointers(applyUnimportantRules(audit, analysis.verdicts()), evidenceText);
        audit.setEngine(analysis.engine());
        applyUsage(audit, analysis.usage());
        setProgress(audit, "scoring", 70, "Scoring verdicts.");
        audit.setCredibilityScore(scoringService.score(normalizedVerdicts));
        audit.setProcessingMillis(System.currentTimeMillis() - started);
        if (replaceVerdicts) {
            audit.getVerdicts().clear();
        }
        for (AnalyzedVerdict analyzed : normalizedVerdicts) {
            audit.addVerdict(toEntity(analyzed));
        }
        countStatuses(audit);
        setProgress(audit, "snapshotting", 90, "Saving audit snapshot.");
        audit.setStatus(AuditStatus.COMPLETED);
        clearFailure(audit);
        audit.setFinishedAt(Instant.now());
        audit.setLastWorkerHeartbeatAt(audit.getFinishedAt());
        setProgress(audit, "completed", 100, "Audit completed.");
        Audit saved = auditRepository.save(audit);
        snapshot(saved);
        rabbitEventPublisher.publish("audit.completed", Map.of("auditId", saved.getId(), "score", saved.getCredibilityScore(), "engine", saved.getEngine()));
        return saved;
    }

    private void failAudit(Audit audit, RuntimeException exception, long started) {
        audit.setStatus(AuditStatus.FAILED);
        audit.setProcessingMillis(System.currentTimeMillis() - started);
        applyFailure(audit, exception);
        audit.setFinishedAt(Instant.now());
        audit.setLastWorkerHeartbeatAt(audit.getFinishedAt());
        setProgress(audit, "failed", 100, "Audit failed: " + exception.getClass().getSimpleName());
        auditRepository.save(audit);
        rabbitEventPublisher.publish("audit.failed", Map.of("auditId", audit.getId(), "error", exception.getClass().getSimpleName()));
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

    private void applyUsage(Audit audit, LlmUsage usage) {
        LlmUsage value = usage == null ? LlmUsage.zero() : usage;
        audit.setPromptTokens(value.promptTokens());
        audit.setCompletionTokens(value.completionTokens());
        audit.setTotalTokens(value.totalTokens());
        audit.setEstimatedCostUsd(value.estimatedCostUsd());
    }

    private void saveProgress(Audit audit, String stage, int percent, String message) {
        setProgress(audit, stage, percent, message);
        audit.setLastWorkerHeartbeatAt(Instant.now());
        auditRepository.saveAndFlush(audit);
    }

    private void setProgress(Audit audit, String stage, int percent, String message) {
        audit.setProgressStage(stage);
        audit.setProgressPercent(percent);
        audit.setProgressMessage(trim(message, 160));
    }

    private long processingMillis(Audit audit) {
        if (audit.getStartedAt() == null || audit.getFinishedAt() == null) {
            return audit.getProcessingMillis();
        }
        return Math.max(0, Duration.between(audit.getStartedAt(), audit.getFinishedAt()).toMillis());
    }

    private void clearFailure(Audit audit) {
        audit.setFailureType(AuditFailureType.NONE);
        audit.setFailureMessage(null);
    }

    private void applyFailure(Audit audit, RuntimeException exception) {
        AuditFailureType type = classifyFailure(exception);
        audit.setFailureType(type);
        audit.setFailureMessage(trim(exception.getMessage(), 240));
    }

    private AuditFailureType classifyFailure(RuntimeException exception) {
        String message = exception.getMessage() == null ? "" : exception.getMessage().toLowerCase(Locale.ROOT);
        String className = exception.getClass().getSimpleName().toLowerCase(Locale.ROOT);
        if (message.contains("war-state can be used") || message.contains("quota")) {
            return AuditFailureType.QUOTA_FAILURE;
        }
        if (message.contains("unsupported file") || message.contains("unsupported format")) {
            return AuditFailureType.UNSUPPORTED_FILE;
        }
        if (exception instanceof SecurityException || message.contains("authentication required") || message.contains("permission")) {
            return AuditFailureType.PERMISSION_FAILURE;
        }
        if (className.contains("timeout") || message.contains("timeout") || message.contains("timed out")) {
            return AuditFailureType.TIMEOUT;
        }
        if (message.contains("parse llm") || message.contains("json") || message.contains("verdicts array")) {
            return AuditFailureType.PARSER_FAILURE;
        }
        if (exception instanceof RestClientException || message.contains("llm request failed") || message.contains("model")) {
            return AuditFailureType.MODEL_FAILURE;
        }
        if (exception instanceof IllegalArgumentException) {
            return AuditFailureType.VALIDATION_FAILURE;
        }
        return AuditFailureType.UNKNOWN;
    }

    private void stampVerdictProvenance(Audit audit) {
        for (Verdict verdict : audit.getVerdicts()) {
            verdict.setEngine(audit.getEngine());
            verdict.setAnalyzerVersion(audit.getAnalyzerVersion());
            verdict.setPromptVersion(audit.getPromptVersion());
        }
    }

    private void snapshot(Audit audit) {
        stampVerdictProvenance(audit);
        try {
            Map<String, Object> snapshotPayload = new LinkedHashMap<>();
            snapshotPayload.put("auditId", audit.getId());
            snapshotPayload.put("claimTitle", audit.getClaimTitle());
            snapshotPayload.put("evidenceTitle", audit.getEvidenceTitle());
            snapshotPayload.put("claimFingerprint", audit.getClaimFingerprint());
            snapshotPayload.put("evidenceFingerprint", audit.getEvidenceFingerprint());
            snapshotPayload.put("score", audit.getCredibilityScore());
            snapshotPayload.put("engine", audit.getEngine());
            snapshotPayload.put("promptTokens", audit.getPromptTokens());
            snapshotPayload.put("completionTokens", audit.getCompletionTokens());
            snapshotPayload.put("totalTokens", audit.getTotalTokens());
            snapshotPayload.put("estimatedCostUsd", audit.getEstimatedCostUsd());
            snapshotPayload.put("analyzerVersion", safe(audit.getAnalyzerVersion()));
            snapshotPayload.put("promptVersion", safe(audit.getPromptVersion()));
            snapshotPayload.put("createdAt", audit.getCreatedAt().toString());
            snapshotPayload.put("verdicts", audit.getVerdicts().stream().map(verdict -> Map.of(
                            "id", verdict.getId(),
                            "sentenceIndex", verdict.getSentenceIndex(),
                            "sentence", verdict.getSentence(),
                            "status", verdict.getStatus().name(),
                            "confidence", verdict.getConfidence().name(),
                            "engine", safe(verdict.getEngine()),
                            "analyzerVersion", safe(verdict.getAnalyzerVersion()),
                            "promptVersion", safe(verdict.getPromptVersion()),
                            "manualOverrideReason", safe(verdict.getManualOverrideReason())
                    )).toList());
            String payload = objectMapper.writeValueAsString(snapshotPayload);
            AuditSnapshot snapshot = new AuditSnapshot();
            snapshot.setAudit(audit);
            snapshot.setOwner(audit.getOwner());
            snapshot.setPayloadJson(payload);
            snapshot.setSnapshotFingerprint(fingerprintService.sha256(payload));
            snapshotRepository.save(snapshot);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not create immutable audit snapshot");
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
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

    private Pageable page(int offset, int limit) {
        int size = Math.min(Math.max(limit, 1), 100);
        int page = Math.max(offset, 0) / size;
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    }
}
