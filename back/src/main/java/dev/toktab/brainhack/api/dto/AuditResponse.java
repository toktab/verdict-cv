package dev.toktab.brainhack.api.dto;

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
        Instant createdAt,
        List<VerdictResponse> verdicts
) {
}
