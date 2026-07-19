package dev.toktab.brainhack.audit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.api.dto.CheckStateResponse;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class CheckStateService {
    private final ObjectMapper objectMapper;
    private final LlmAuditAnalyzer llmAuditAnalyzer;
    private List<CheckStateDefinition> definitions = List.of();

    public CheckStateService(ObjectMapper objectMapper, LlmAuditAnalyzer llmAuditAnalyzer) {
        this.objectMapper = objectMapper;
        this.llmAuditAnalyzer = llmAuditAnalyzer;
    }

    @PostConstruct
    void loadDefaults() throws IOException {
        definitions = objectMapper.readValue(
                new ClassPathResource("default-check-states.json").getInputStream(),
                new TypeReference<>() {
                });
    }

    public List<CheckStateResponse> states() {
        boolean configured = llmAuditAnalyzer.configured();
        return definitions.stream().map(state -> response(state, configured)).toList();
    }

    public CheckStateResponse select(String id) {
        if (id == null || id.isBlank()) {
            return states().stream().findFirst().orElseThrow(() -> new IllegalStateException("No check states configured"));
        }
        return states().stream()
                .filter(state -> state.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Check state not found: " + id));
    }

    private CheckStateResponse response(CheckStateDefinition state, boolean aiConfigured) {
        String message = !state.requiresLlm()
                ? "Ready - runs locally"
                : aiConfigured
                ? "AI provider connected"
                : "AI key missing - local fallback will be used";
        return new CheckStateResponse(
                state.id(), state.name(), state.description(), state.intensity(), state.paid(),
                state.strategy(), state.requiresLlm(), aiConfigured, message, state.capabilities());
    }

    private record CheckStateDefinition(
            String id,
            String name,
            String description,
            String intensity,
            boolean paid,
            String strategy,
            boolean requiresLlm,
            List<String> capabilities
    ) {
    }
}
