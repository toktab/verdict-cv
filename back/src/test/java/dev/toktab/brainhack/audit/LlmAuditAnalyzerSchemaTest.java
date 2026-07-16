package dev.toktab.brainhack.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class LlmAuditAnalyzerSchemaTest {
    private final LlmAuditAnalyzer analyzer = new LlmAuditAnalyzer(
            "test-key",
            "test-model",
            0.1,
            "https://example.test",
            1,
            1,
            0,
            new BigDecimal("1.00"),
            new BigDecimal("2.00"),
            new ObjectMapper(),
            RestClient.builder(),
            null
    );

    @Test
    void repairsFencedJsonAndDefaultsInvalidRowsSafely() {
        String response = """
                {
                  "choices": [{
                    "message": {
                      "content": "```json\\n{\\\"verdicts\\\":[{\\\"sentenceIndex\\\":0,\\\"sentence\\\":\\\"ignored\\\",\\\"status\\\":\\\"SUPPORTED\\\",\\\"confidence\\\":\\\"HIGH\\\",\\\"reasonCategory\\\":\\\"matched evidence\\\",\\\"explanation\\\":\\\"Evidence matches.\\\",\\\"evidencePointer\\\":\\\"Java API\\\"},{\\\"sentenceIndex\\\":1,\\\"status\\\":\\\"BROKEN\\\",\\\"confidence\\\":\\\"ODD\\\",\\\"explanation\\\":\\\"Invalid enums are repaired.\\\",\\\"evidencePointer\\\":\\\"No evidence found.\\\"}]}\\n```"
                    }
                  }]
                }
                """;

        List<AnalyzedVerdict> verdicts = analyzer.parse(response, List.of("Built Java API.", "Led a team."));

        assertEquals(VerdictStatus.SUPPORTED, verdicts.get(0).status());
        assertEquals("Built Java API.", verdicts.get(0).sentence());
        assertEquals(VerdictStatus.UNSUPPORTED, verdicts.get(1).status());
        assertEquals(Confidence.MEDIUM, verdicts.get(1).confidence());
    }

    @Test
    void failsVisiblyWhenVerdictsArrayIsMissing() {
        String response = """
                {"choices":[{"message":{"content":"{\\"items\\":[]}"}}]}
                """;

        assertThrows(IllegalStateException.class, () -> analyzer.parse(response, List.of("Claim.")));
    }

    @Test
    void extractsTokensAndEstimatesCostFromUsageBlock() {
        String response = """
                {
                  "usage": {
                    "prompt_tokens": 1500,
                    "completion_tokens": 250,
                    "total_tokens": 1750
                  },
                  "choices": [{"message": {"content": "{\\"verdicts\\":[]}"}}]
                }
                """;

        LlmUsage usage = analyzer.usage(response);

        assertEquals(1500, usage.promptTokens());
        assertEquals(250, usage.completionTokens());
        assertEquals(1750, usage.totalTokens());
        assertEquals(new BigDecimal("0.002000"), usage.estimatedCostUsd());
    }

    @Test
    void exposesConfiguredTimeoutAttemptsAndLinearBackoff() {
        LlmAuditAnalyzer.LlmRuntimeConfiguration configuration = analyzer.runtimeConfiguration();

        assertEquals(1, configuration.timeoutSeconds());
        assertEquals(1, configuration.maxAttempts());
        assertEquals(0, configuration.backoffMillis());
        assertEquals(0, analyzer.retryDelayMillis(1));

        LlmAuditAnalyzer retryingAnalyzer = new LlmAuditAnalyzer(
                "test-key",
                "test-model",
                0.1,
                "https://example.test",
                12,
                3,
                500,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new ObjectMapper(),
                RestClient.builder(),
                null
        );

        assertEquals(500, retryingAnalyzer.retryDelayMillis(1));
        assertEquals(1000, retryingAnalyzer.retryDelayMillis(2));
        assertEquals(0, retryingAnalyzer.retryDelayMillis(3));
    }
}
