package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.ats.AtsKeywordCatalog;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LocalAuditStatePolicyTest {
    private final AtsKeywordCatalog catalog = mock(AtsKeywordCatalog.class);
    private final LocalAuditAnalyzer analyzer = new LocalAuditAnalyzer(catalog);

    @Test
    void lightAndStrictApplyDifferentProofBurdensToTheSameDocuments() {
        when(catalog.localAuditRiskyWords()).thenReturn(List.of("expert"));
        List<String> claims = List.of("Expert Java platform engineer.");
        String evidence = "Java engineer.";

        AuditAnalysisResult light = analyzer.analyzeForState(CheckStateIds.LIGHT, claims, evidence);
        AuditAnalysisResult war = analyzer.analyzeForState(CheckStateIds.WAR, claims, evidence);
        AuditAnalysisResult strict = analyzer.analyzeForState(CheckStateIds.STRICT_WAR_AI, claims, evidence);

        assertThat(light.engine()).isEqualTo("LOCAL_LIGHT_V2");
        assertThat(light.verdicts().get(0).status()).isEqualTo(VerdictStatus.SUPPORTED);
        assertThat(war.verdicts().get(0).status()).isEqualTo(VerdictStatus.STRETCHED);
        assertThat(strict.verdicts().get(0).status()).isEqualTo(VerdictStatus.UNSUPPORTED);
    }

    @Test
    void personFallbackReturnsReviewableUncertaintyInsteadOfPretendingAiRan() {
        when(catalog.localAuditRiskyWords()).thenReturn(List.of());

        AuditAnalysisResult result = analyzer.analyzeForState(
                CheckStateIds.PERSON,
                List.of("Led migration delivery for 20 customers."),
                "Contributed to customer migration planning.");

        assertThat(result.engine()).isEqualTo("LOCAL_PERSON_FALLBACK_V2");
        assertThat(result.verdicts().get(0).status()).isEqualTo(VerdictStatus.STRETCHED);
        assertThat(result.verdicts().get(0).confidence()).isEqualTo(Confidence.LOW);
    }
}
