package dev.toktab.brainhack.api.dto;

import dev.toktab.brainhack.audit.AuditStatus;
import dev.toktab.brainhack.audit.AuditFailureType;
import java.math.BigDecimal;
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
        int promptTokens,
        int completionTokens,
        int totalTokens,
        BigDecimal estimatedCostUsd,
        String analyzerVersion,
        String promptVersion,
        AuditStatus status,
        AuditFailureType failureType,
        String failureMessage,
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
