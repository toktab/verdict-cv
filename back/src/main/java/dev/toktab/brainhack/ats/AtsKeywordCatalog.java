package dev.toktab.brainhack.ats;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class AtsKeywordCatalog {
    private final List<String> riskyWords;
    private final List<String> localAuditRiskyWords;
    private final List<String> techTerms;

    public AtsKeywordCatalog(ObjectMapper objectMapper) {
        JsonNode analyzers = readCatalog(objectMapper).path("analyzers");
        this.riskyWords = strings(analyzers.path("riskyWords"));
        this.localAuditRiskyWords = strings(analyzers.path("localAuditRiskyWords"));
        this.techTerms = strings(analyzers.path("techTerms"));
    }

    public List<String> riskyWords() {
        return riskyWords;
    }

    public List<String> localAuditRiskyWords() {
        return localAuditRiskyWords;
    }

    public List<String> techTerms() {
        return techTerms;
    }

    private JsonNode readCatalog(ObjectMapper objectMapper) {
        ClassPathResource resource = new ClassPathResource("default-ats.json");
        if (!resource.exists()) {
            throw new IllegalStateException("default-ats.json is missing from the classpath");
        }
        try (InputStream input = resource.getInputStream()) {
            return objectMapper.readTree(input);
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not read default ATS keyword catalog", exception);
        }
    }

    private List<String> strings(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<String> rows = new ArrayList<>();
        node.forEach(value -> {
            if (value.isTextual() && !value.asText().isBlank()) {
                rows.add(value.asText());
            }
        });
        return List.copyOf(rows);
    }
}
