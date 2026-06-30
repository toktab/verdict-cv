package dev.toktab.brainhack.api.dto;

import dev.toktab.brainhack.audit.AuditStatus;
import java.math.BigDecimal;
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
        int promptTokens,
        int completionTokens,
        int totalTokens,
        BigDecimal estimatedCostUsd,
        String analyzerVersion,
        String promptVersion,
        AuditStatus status,
        String templateId,
        String templateName,
        String checkStateId,
        String checkStateName,
        Instant createdAt,
        List<VerdictResponse> topProblems
) {
}
