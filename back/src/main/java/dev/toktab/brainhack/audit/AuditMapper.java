package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.api.dto.AuditResponse;
import dev.toktab.brainhack.api.dto.AuditProgressResponse;
import dev.toktab.brainhack.api.dto.AuditSummaryResponse;
import dev.toktab.brainhack.api.dto.VerdictResponse;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class AuditMapper {
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
                audit.getCreatedAt(),
                audit.getVerdicts().stream().map(this::toVerdictResponse).toList()
        );
    }

    public AuditSummaryResponse toSummary(Audit audit) {
        List<VerdictResponse> topProblems = audit.getVerdicts().stream()
                .filter(v -> v.getStatus() == VerdictStatus.UNSUPPORTED || v.getStatus() == VerdictStatus.STRETCHED || v.getStatus() == VerdictStatus.GAP)
                .sorted(Comparator.comparing(Verdict::getStatus).reversed())
                .limit(3)
                .map(this::toVerdictResponse)
                .toList();
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
        return new VerdictResponse(
                verdict.getId(),
                verdict.getSentenceIndex(),
                verdict.getSentence(),
                verdict.getStatus(),
                verdict.getConfidence(),
                verdict.getReasonCategory(),
                verdict.getExplanation(),
                verdict.getEvidencePointer(),
                verdict.getEngine(),
                verdict.getAnalyzerVersion(),
                verdict.getPromptVersion(),
                verdict.getManualOverrideReason()
        );
    }
}
