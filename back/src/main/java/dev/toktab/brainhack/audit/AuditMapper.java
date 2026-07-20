package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.api.dto.AuditResponse;
import dev.toktab.brainhack.api.dto.AuditProgressResponse;
import dev.toktab.brainhack.api.dto.AuditSummaryResponse;
import dev.toktab.brainhack.api.dto.VerdictResponse;
import java.util.Comparator;
import java.util.List;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Component;

@Component
public class AuditMapper {
    private final VerdictRevisionService revisionService;

    public AuditMapper(VerdictRevisionService revisionService) {
        this.revisionService = revisionService;
    }

    public AuditResponse toResponse(Audit audit) {
        return new AuditResponse(
                audit.getId(),
                audit.getClaimTitle(),
                audit.getEvidenceTitle(),
                audit.getClaimText(),
                audit.getEvidenceText(),
                audit.getCredibilityScore(),
                audit.getSupportedCount(),
                audit.getStretchedCount(),
                audit.getUnsupportedCount(),
                audit.getNotClaimCount(),
                audit.getGapCount(),
                audit.getClaimFingerprint(),
                audit.getEvidenceFingerprint(),
                audit.getProcessingMillis(),
                audit.getEngine(),
                audit.getPromptTokens(),
                audit.getCompletionTokens(),
                audit.getTotalTokens(),
                audit.getEstimatedCostUsd(),
                audit.getAnalyzerVersion(),
                audit.getPromptVersion(),
                audit.getStatus(),
                audit.getFailureType(),
                audit.getFailureMessage(),
                audit.getTemplateId(),
                audit.getTemplateName(),
                audit.getTemplateDescription(),
                audit.getCheckStateId(),
                audit.getCheckStateName(),
                audit.getCheckStateDescription(),
                audit.getProjectId(),
                audit.getCandidateId(),
                audit.getCandidateAnalysisRunId(),
                audit.getCreatedAt(),
                verdictResponses(audit)
        );
    }

    public AuditSummaryResponse toSummary(Audit audit) {
        List<VerdictResponse> topProblems = Hibernate.isInitialized(audit.getVerdicts()) ? audit.getVerdicts().stream()
                .filter(v -> !revisionService.effective(v).deleted())
                .filter(v -> {
                    VerdictStatus status = revisionService.effective(v).status();
                    return status == VerdictStatus.UNSUPPORTED || status == VerdictStatus.STRETCHED || status == VerdictStatus.GAP;
                })
                .sorted(Comparator.comparing(v -> revisionService.effective(v).status(), Comparator.reverseOrder()))
                .limit(3)
                .map(this::toVerdictResponse)
                .toList() : List.of();
        return new AuditSummaryResponse(
                audit.getId(),
                audit.getClaimTitle(),
                audit.getEvidenceTitle(),
                audit.getCredibilityScore(),
                audit.getSupportedCount(),
                audit.getStretchedCount(),
                audit.getUnsupportedCount(),
                audit.getGapCount(),
                audit.getProcessingMillis(),
                audit.getEngine(),
                audit.getPromptTokens(),
                audit.getCompletionTokens(),
                audit.getTotalTokens(),
                audit.getEstimatedCostUsd(),
                audit.getAnalyzerVersion(),
                audit.getPromptVersion(),
                audit.getStatus(),
                audit.getFailureType(),
                audit.getFailureMessage(),
                audit.getTemplateId(),
                audit.getTemplateName(),
                audit.getCheckStateId(),
                audit.getCheckStateName(),
                audit.getCreatedAt(),
                topProblems
        );
    }

    public AuditProgressResponse toProgress(Audit audit) {
        return new AuditProgressResponse(
                audit.getId(),
                audit.getStatus(),
                audit.getFailureType(),
                audit.getFailureMessage(),
                audit.getProgressStage(),
                audit.getProgressPercent(),
                audit.getProgressMessage(),
                audit.getProcessingMillis(),
                audit.getEngine(),
                audit.getJobAttempts(),
                audit.getQueuedAt(),
                audit.getStartedAt(),
                audit.getFinishedAt(),
                audit.getLastWorkerHeartbeatAt(),
                audit.getCreatedAt()
        );
    }

    public VerdictResponse toVerdictResponse(Verdict verdict) {
        VerdictRevisionService.EffectiveVerdict effective = revisionService.effective(verdict);
        return new VerdictResponse(
                verdict.getId(),
                verdict.getSentenceIndex(),
                verdict.getSentence(),
                effective.status(),
                effective.confidence(),
                effective.reasonCategory(),
                effective.explanation(),
                effective.evidencePointer(),
                verdict.getEngine(),
                verdict.getAnalyzerVersion(),
                verdict.getPromptVersion(),
                effective.overrideReason()
        );
    }

    private List<VerdictResponse> verdictResponses(Audit audit) {
        if (!Hibernate.isInitialized(audit.getVerdicts())) {
            return List.of();
        }
        return audit.getVerdicts().stream()
                .filter(verdict -> !revisionService.effective(verdict).deleted())
                .map(this::toVerdictResponse)
                .toList();
    }
}
