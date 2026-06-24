package dev.toktab.brainhack.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class ScoringServiceTest {
    private final ScoringService scoringService = new ScoringService();

    @Test
    void scoresOnlyRealClaims() {
        List<AnalyzedVerdict> verdicts = List.of(
                verdict(VerdictStatus.SUPPORTED),
                verdict(VerdictStatus.STRETCHED),
                verdict(VerdictStatus.UNSUPPORTED),
                verdict(VerdictStatus.NOT_A_CLAIM)
        );

        assertThat(scoringService.score(verdicts)).isEqualTo(47);
    }

    private AnalyzedVerdict verdict(VerdictStatus status) {
        return new AnalyzedVerdict(0, "sentence", status, Confidence.HIGH, "reason", "explanation", "pointer");
    }
}
