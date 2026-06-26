package dev.toktab.brainhack.audit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.api.dto.AuditTemplateRequest;
import dev.toktab.brainhack.api.dto.AuditTemplateResponse;
import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class AuditTemplateService {
    private final AuditTemplateRepository repository;
    private final ObjectMapper objectMapper;
    private List<DefaultTemplate> defaultTemplates = List.of();

    public AuditTemplateService(AuditTemplateRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadDefaults() throws IOException {
        defaultTemplates = objectMapper.readValue(
                new ClassPathResource("default-audit-templates.json").getInputStream(),
                new TypeReference<>() {
                });
    }

    public List<AuditTemplateResponse> templatesFor(UserAccount owner) {
        List<AuditTemplateResponse> templates = new ArrayList<>();
        defaultTemplates.stream().map(DefaultTemplate::toResponse).forEach(templates::add);
        repository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner.getId()).stream()
                .map(this::toResponse)
                .forEach(templates::add);
        repository.findBySharedTrueAndDeletedAtIsNullOrderByCreatedAtDesc().stream()
                .filter(template -> !template.getOwner().getId().equals(owner.getId()))
                .map(this::toResponse)
                .forEach(templates::add);
        return templates;
    }

    @Transactional
    public AuditTemplateResponse create(UserAccount owner, AuditTemplateRequest request) {
        AuditTemplate template = new AuditTemplate();
        template.setOwner(owner);
        template.setMode(clean(request.mode()).toLowerCase());
        template.setName(clean(request.name()));
        template.setDescription(clean(request.description()));
        template.setInstructions(clean(request.instructions()));
        template.setMarkUnimportant(clean(request.markUnimportant()));
        template.setShared(request.shared());
        return toResponse(repository.save(template));
    }

    public SelectedAuditTemplate select(UserAccount owner, String id, String mode) {
        if (id == null || id.isBlank()) {
            String normalizedMode = clean(mode).toLowerCase();
            if (normalizedMode.isBlank()) {
                normalizedMode = "cv";
            }
            String selectedMode = normalizedMode;
            return defaultTemplates.stream()
                    .filter(template -> selectedMode.equals(template.mode()))
                    .findFirst()
                    .or(() -> defaultTemplates.stream().findFirst())
                    .map(DefaultTemplate::toSelected)
                    .orElse(SelectedAuditTemplate.none());
        }
        for (DefaultTemplate template : defaultTemplates) {
            if (template.id().equals(id)) {
                return template.toSelected();
            }
        }
        if (id.startsWith("custom-")) {
            Long templateId = Long.valueOf(id.substring("custom-".length()));
            return repository.findById(templateId)
                    .filter(template -> template.getDeletedAt() == null)
                    .filter(template -> template.isShared() || template.getOwner().getId().equals(owner.getId()))
                    .map(template -> new SelectedAuditTemplate("custom-" + template.getId(), template.getName(), template.getDescription(), template.getInstructions(), rules(template.getMarkUnimportant())))
                    .orElseThrow(() -> new IllegalArgumentException("Audit template not found: " + id));
        }
        throw new IllegalArgumentException("Audit template not found: " + id);
    }

    private AuditTemplateResponse toResponse(AuditTemplate template) {
        return new AuditTemplateResponse(
                "custom-" + template.getId(),
                "custom",
                template.getMode(),
                template.getName(),
                template.getDescription(),
                template.getInstructions(),
                template.getMarkUnimportant(),
                template.isShared(),
                template.getCreatedAt());
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private List<String> rules(String value) {
        return List.of(clean(value).split("[,\\n]")).stream()
                .map(String::trim)
                .filter(rule -> !rule.isBlank())
                .toList();
    }

    private record DefaultTemplate(String id, String mode, String name, String description, String instructions, List<String> markUnimportant) {
        AuditTemplateResponse toResponse() {
            return new AuditTemplateResponse(id, "default", mode, name, description, instructions, String.join(", ", Objects.requireNonNullElse(markUnimportant, List.of())), true, Instant.EPOCH);
        }

        SelectedAuditTemplate toSelected() {
            return new SelectedAuditTemplate(id, name, description, instructions, Objects.requireNonNullElse(markUnimportant, List.of()));
        }
    }

    public record SelectedAuditTemplate(String id, String name, String description, String instructions, List<String> markUnimportant) {
        static SelectedAuditTemplate none() {
            return new SelectedAuditTemplate("", "", "", "", List.of());
        }
    }
}
