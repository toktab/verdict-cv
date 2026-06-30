package dev.toktab.brainhack.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class LlmAuditAnalyzerSchemaTest {
    private final LlmAuditAnalyzer analyzer = new LlmAuditAnalyzer(
            "test-key",
            "test-model",
            0.1,
            "https://example.test",
            new ObjectMapper(),
            RestClient.builder()
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
}
