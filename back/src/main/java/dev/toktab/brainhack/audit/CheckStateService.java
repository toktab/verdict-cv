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
    private List<CheckStateResponse> states = List.of();

    public CheckStateService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadDefaults() throws IOException {
        states = objectMapper.readValue(
                new ClassPathResource("default-check-states.json").getInputStream(),
                new TypeReference<>() {
                });
    }

    public List<CheckStateResponse> states() {
        return states;
    }

    public CheckStateResponse select(String id) {
        if (id == null || id.isBlank()) {
            return states.stream().findFirst().orElse(new CheckStateResponse("", "", "", "", false));
        }
        return states.stream()
                .filter(state -> state.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Check state not found: " + id));
    }
}
