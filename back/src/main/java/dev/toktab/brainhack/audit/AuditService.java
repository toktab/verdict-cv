package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.events.RabbitEventPublisher;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
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
        this.maxClaimChars = maxClaimChars;
        this.maxEvidenceChars = maxEvidenceChars;
    }

    @Transactional
    public Audit run(AuditRunRequest request, HttpServletRequest httpRequest) {
        long started = System.currentTimeMillis();
        String claimText = trim(request.claimText(), maxClaimChars);
        String evidenceText = trim(request.evidenceText(), maxEvidenceChars);
        List<String> sentences = sentenceSplitter.split(claimText);
        if (sentences.isEmpty()) {
            throw new IllegalArgumentException("Claim document does not contain auditable text.");
        }
        rabbitEventPublisher.publish("audit.requested", Map.of("claimTitle", title(request.claimTitle(), "Claim Document"), "sentenceCount", sentences.size()));
        AuditAnalysisResult analysis = analyze(sentences, evidenceText);
        Audit audit = new Audit();
        audit.setClaimTitle(title(request.claimTitle(), "Claim Document"));
        audit.setEvidenceTitle(title(request.evidenceTitle(), "Evidence Document"));
        audit.setClaimText(claimText);
        audit.setEvidenceText(evidenceText);
        audit.setClaimFingerprint(fingerprintService.sha256(claimText));
        audit.setEvidenceFingerprint(fingerprintService.sha256(evidenceText));
        audit.setEngine(analysis.engine());
        audit.setCredibilityScore(scoringService.score(analysis.verdicts()));
        audit.setProcessingMillis(System.currentTimeMillis() - started);
        for (AnalyzedVerdict analyzed : analysis.verdicts()) {
            audit.addVerdict(toEntity(analyzed));
        }
        countStatuses(audit);
        Audit saved = auditRepository.save(audit);
        rabbitEventPublisher.publish("audit.completed", Map.of("auditId", saved.getId(), "score", saved.getCredibilityScore(), "engine", saved.getEngine()));
        logService.record("AUDIT_RUN", httpRequest, 200, saved.getProcessingMillis(), "visitor", "auditId=" + saved.getId() + "; score=" + saved.getCredibilityScore() + "; engine=" + saved.getEngine());
        return saved;
    }

    public Audit get(Long id) {
        return auditRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Audit not found: " + id));
    }

    public List<Audit> history() {
        return auditRepository.findAll().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void delete(Long id) {
        auditRepository.deleteById(id);
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

    private String title(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }
}
