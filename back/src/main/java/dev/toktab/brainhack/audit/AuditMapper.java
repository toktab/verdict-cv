package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.api.dto.AuditResponse;
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
                audit.getStatus(),
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
                audit.getStatus(),
                audit.getCreatedAt(),
                topProblems
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
                verdict.getEvidencePointer()
        );
    }
}
