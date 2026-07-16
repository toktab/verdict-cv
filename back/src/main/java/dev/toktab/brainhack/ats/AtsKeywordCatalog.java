package dev.toktab.brainhack.ats;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AtsKeywordCatalog {
    private final ObjectMapper objectMapper;
    private final OfficialAtsTemplateVersionRepository repository;
    private final String bundledCatalogJson;
    private volatile CatalogSnapshot snapshot;

    public AtsKeywordCatalog(ObjectMapper objectMapper, OfficialAtsTemplateVersionRepository repository) {
        this.objectMapper = objectMapper;
        this.repository = repository;
        JsonNode bundled = readCatalog(objectMapper);
        this.bundledCatalogJson = writeCatalog(bundled);
        this.snapshot = snapshot(0, bundled);
    }

    public List<String> riskyWords() {
        return activeSnapshot().riskyWords();
    }

    public List<String> localAuditRiskyWords() {
        return activeSnapshot().localAuditRiskyWords();
    }

    public List<String> techTerms() {
        return activeSnapshot().techTerms();
    }

    public List<OfficialAtsVersionResponse> versions() {
        ensureSeeded();
        return repository.findAllByOrderByVersionNumberDesc().stream().map(this::response).toList();
    }

    @Transactional
    public OfficialAtsVersionResponse publish(String catalogJson, String changeNote, String adminUsername) {
        JsonNode catalog = validate(catalogJson);
        repository.findAll().stream().filter(OfficialAtsTemplateVersion::isActive).forEach(row -> row.setActive(false));
        int nextVersion = repository.findFirstByOrderByVersionNumberDesc().map(row -> row.getVersionNumber() + 1).orElse(1);
        OfficialAtsTemplateVersion row = new OfficialAtsTemplateVersion();
        row.setVersionNumber(nextVersion);
        row.setCatalogJson(writeCatalog(catalog));
        row.setChangeNote(clean(changeNote, "Published official ATS rules"));
        row.setCreatedBy(clean(adminUsername, "admin"));
        row.setActive(true);
        row.setCreatedAt(Instant.now());
        OfficialAtsTemplateVersion saved = repository.save(row);
        snapshot = snapshot(saved.getVersionNumber(), catalog);
        return response(saved);
    }

    @Transactional
    public OfficialAtsVersionResponse rollback(Long versionId, String changeNote, String adminUsername) {
        OfficialAtsTemplateVersion source = repository.findById(versionId)
                .orElseThrow(() -> new IllegalArgumentException("ATS template version not found: " + versionId));
        return publish(source.getCatalogJson(), clean(changeNote, "Rolled back to version " + source.getVersionNumber()), adminUsername);
    }

    private CatalogSnapshot activeSnapshot() {
        ensureSeeded();
        return snapshot;
    }

    @Transactional
    public synchronized void ensureSeeded() {
        OfficialAtsTemplateVersion active = repository.findFirstByActiveTrueOrderByVersionNumberDesc().orElse(null);
        if (active == null) {
            OfficialAtsTemplateVersion seed = new OfficialAtsTemplateVersion();
            seed.setVersionNumber(repository.findFirstByOrderByVersionNumberDesc().map(row -> row.getVersionNumber() + 1).orElse(1));
            seed.setCatalogJson(bundledCatalogJson);
            seed.setChangeNote("Seeded bundled default ATS catalog");
            seed.setCreatedBy("system");
            seed.setActive(true);
            seed.setCreatedAt(Instant.now());
            active = repository.save(seed);
        }
        if (snapshot.version() != active.getVersionNumber()) {
            snapshot = snapshot(active.getVersionNumber(), parse(active.getCatalogJson()));
        }
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

    private JsonNode validate(String catalogJson) {
        JsonNode root = parse(catalogJson);
        if (root == null || !root.isObject()) {
            throw new IllegalArgumentException("ATS catalog must be a JSON object");
        }
        JsonNode analyzers = root.path("analyzers");
        requireTextArray(analyzers, "riskyWords");
        requireTextArray(analyzers, "localAuditRiskyWords");
        requireTextArray(analyzers, "techTerms");
        JsonNode rules = root.path("rules");
        if (!rules.isArray() || rules.isEmpty()) {
            throw new IllegalArgumentException("ATS catalog must contain at least one rule");
        }
        Set<String> ruleIds = new HashSet<>();
        rules.forEach(rule -> {
            if (!rule.isObject() || rule.path("id").asText().isBlank()) {
                throw new IllegalArgumentException("Every ATS rule must have an id");
            }
            String ruleId = rule.path("id").asText();
            if (!ruleIds.add(ruleId)) {
                throw new IllegalArgumentException("ATS rule ids must be unique: " + ruleId);
            }
            JsonNode patterns = rule.path("patterns");
            if (!patterns.isMissingNode() && !patterns.isArray()) {
                throw new IllegalArgumentException("Rule patterns must be an array: " + rule.path("id").asText());
            }
            patterns.forEach(value -> {
                if (!value.isTextual() || value.asText().isBlank()) {
                    throw new IllegalArgumentException("Rule patterns must contain non-empty strings: " + ruleId);
                }
                compilePattern(value.asText(), ruleId);
            });
        });
        return root;
    }

    private void requireTextArray(JsonNode analyzers, String field) {
        JsonNode node = analyzers.path(field);
        if (!node.isArray() || node.isEmpty()) {
            throw new IllegalArgumentException("analyzers." + field + " must be a non-empty string array");
        }
        node.forEach(value -> {
            if (!value.isTextual() || value.asText().isBlank()) {
                throw new IllegalArgumentException("analyzers." + field + " must contain non-empty strings");
            }
        });
    }

    private void compilePattern(String expression, String ruleId) {
        try {
            Pattern.compile(expression);
        } catch (PatternSyntaxException exception) {
            throw new IllegalArgumentException("Invalid regex in rule " + ruleId + ": " + exception.getDescription());
        }
    }

    private JsonNode parse(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (IOException exception) {
            throw new IllegalArgumentException("ATS catalog is not valid JSON", exception);
        }
    }

    private String writeCatalog(JsonNode catalog) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(catalog);
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not serialize ATS catalog", exception);
        }
    }

    private CatalogSnapshot snapshot(int version, JsonNode catalog) {
        JsonNode analyzers = catalog.path("analyzers");
        return new CatalogSnapshot(version, strings(analyzers.path("riskyWords")), strings(analyzers.path("localAuditRiskyWords")), strings(analyzers.path("techTerms")));
    }

    private OfficialAtsVersionResponse response(OfficialAtsTemplateVersion row) {
        return new OfficialAtsVersionResponse(row.getId(), row.getVersionNumber(), row.isActive(), row.getCatalogJson(), row.getChangeNote(), row.getCreatedBy(), row.getCreatedAt());
    }

    private String clean(String value, String fallback) {
        String cleaned = value == null ? "" : value.trim();
        return cleaned.isBlank() ? fallback : cleaned;
    }

    private record CatalogSnapshot(int version, List<String> riskyWords, List<String> localAuditRiskyWords, List<String> techTerms) {
    }

    public record OfficialAtsVersionResponse(Long id, int version, boolean active, String catalogJson, String changeNote, String createdBy, Instant createdAt) {
    }
}
