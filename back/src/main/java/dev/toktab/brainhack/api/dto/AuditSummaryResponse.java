package dev.toktab.brainhack.api.dto;

import dev.toktab.brainhack.audit.AuditStatus;
import java.time.Instant;
import java.util.List;

public record AuditSummaryResponse(
        Long id,
        String claimTitle,
        String evidenceTitle,
        int credibilityScore,
        int supportedCount,
        int stretchedCount,
        int unsupportedCount,
        int gapCount,
        long processingMillis,
        String engine,
        AuditStatus status,
        Instant createdAt,
        List<VerdictResponse> topProblems
) {
}
