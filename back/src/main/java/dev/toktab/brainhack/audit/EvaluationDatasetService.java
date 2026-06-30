package dev.toktab.brainhack.audit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class EvaluationDatasetService {
    private static final TypeReference<List<EvaluationExample>> EXAMPLES = new TypeReference<>() {};

    private final List<EvaluationExample> examples;

    public EvaluationDatasetService(ObjectMapper objectMapper) {
        try (InputStream input = getClass().getResourceAsStream("/verdict-evaluation-dataset.json")) {
            if (input == null) {
                throw new IllegalStateException("Evaluation dataset resource is missing");
            }
            this.examples = List.copyOf(objectMapper.readValue(input, EXAMPLES));
        } catch (IOException exception) {
            throw new IllegalStateException("Could not load evaluation dataset", exception);
        }
    }

    public EvaluationDatasetResponse dataset() {
        return new EvaluationDatasetResponse("verdict-eval-v1", examples);
    }

    public record EvaluationDatasetResponse(String version, List<EvaluationExample> examples) {
    }

    public record EvaluationExample(
            String id,
            VerdictStatus expectedStatus,
            String claim,
            String evidence,
            String category,
            String reason
    ) {
    }
}
