package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.events.RabbitEventPublisher;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
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
        audit.setStatus(AuditStatus.RUNNING);
        audit.setOwner(owner);
        applyTemplate(audit, owner, request.templateId());
        audit = auditRepository.saveAndFlush(audit);
        try {
            AuditAnalysisResult analysis = analyze(sentences, evidenceText);
            List<AnalyzedVerdict> normalizedVerdicts = normalizeEvidencePointers(analysis.verdicts(), evidenceText);
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

    private AuditAnalysisResult analyze(List<String> sentences, String evidenceText) {
        if (llmAuditAnalyzer.configured()) {
            try {
                return llmAuditAnalyzer.analyze(sentences, evidenceText);
            } catch (RuntimeException exception) {
                logService.recordSystem("LLM_FALLBACK", exception.getMessage());
            }
        }
        return localAuditAnalyzer.analyze(sentences, evidenceText);
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
        audit.setStatus(AuditStatus.RUNNING);
        audit.setOwner(owner);
        applyTemplate(audit, owner, request.templateId());
        Audit saved = auditRepository.saveAndFlush(audit);
        rabbitEventPublisher.publish("audit.requested", Map.of("auditId", saved.getId(), "claimTitle", saved.getClaimTitle()));
        return saved;
    }

    private void completeAsync(Long auditId) {
        long started = System.currentTimeMillis();
        Audit audit = auditRepository.findByIdAndDeletedAtIsNull(auditId).orElse(null);
        if (audit == null) {
            return;
        }
        try {
            List<String> sentences = sentenceSplitter.split(audit.getClaimText());
            AuditAnalysisResult analysis = analyze(sentences, audit.getEvidenceText());
            List<AnalyzedVerdict> normalizedVerdicts = normalizeEvidencePointers(analysis.verdicts(), audit.getEvidenceText());
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
