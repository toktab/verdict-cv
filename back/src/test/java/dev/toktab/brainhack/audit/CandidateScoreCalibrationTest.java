package dev.toktab.brainhack.audit;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.List;
import org.junit.jupiter.api.Test;

class CandidateScoreCalibrationTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ScoringService scoringService = new ScoringService();

    @Test
    void scoringRemainsCalibratedAgainstNamedHiringFixtures() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/candidate-score-calibration.json")) {
            assertThat(input).isNotNull();
            List<Fixture> fixtures = objectMapper.readValue(input, new TypeReference<>() {});
            assertThat(fixtures).extracting(Fixture::name)
                    .containsExactly("strong alignment", "mixed review", "weak alignment", "non-claims do not inflate score");

            for (Fixture fixture : fixtures) {
                List<AnalyzedVerdict> verdicts = fixture.statuses().stream()
                        .map(status -> new AnalyzedVerdict(
                                0,
                                fixture.name(),
                                status,
                                Confidence.HIGH,
                                "calibration",
                                "Named calibration fixture",
                                "fixture"))
                        .toList();
                assertThat(scoringService.score(verdicts))
                        .as(fixture.name())
                        .isEqualTo(fixture.expectedScore());
            }
        }
    }

    private record Fixture(String name, List<VerdictStatus> statuses, int expectedScore) {
    }
}
