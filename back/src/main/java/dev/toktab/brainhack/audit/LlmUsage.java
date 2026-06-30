package dev.toktab.brainhack.audit;

import java.math.BigDecimal;

public record LlmUsage(
        int promptTokens,
        int completionTokens,
        int totalTokens,
        BigDecimal estimatedCostUsd
) {
    public static LlmUsage zero() {
        return new LlmUsage(0, 0, 0, BigDecimal.ZERO);
    }
}
