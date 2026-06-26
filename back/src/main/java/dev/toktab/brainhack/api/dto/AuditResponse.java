package dev.toktab.brainhack.api.dto;

import dev.toktab.brainhack.audit.AuditStatus;
import java.time.Instant;
import java.util.List;

public record AuditResponse(
        Long id,
        String claimTitle,
        String evidenceTitle,
        String claimText,
        String evidenceText,
        int credibilityScore,
        int supportedCount,
        int stretchedCount,
        int unsupportedCount,
        int notClaimCount,
        int gapCount,
        String claimFingerprint,
        String evidenceFingerprint,
        long processingMillis,
        String engine,
        AuditStatus status,
        String templateId,
        String templateName,
        String templateDescription,
        String checkStateId,
        String checkStateName,
        String checkStateDescription,
        Instant createdAt,
        List<VerdictResponse> verdicts
) {
}
