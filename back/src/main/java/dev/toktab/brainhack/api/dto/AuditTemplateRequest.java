package dev.toktab.brainhack.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuditTemplateRequest(
        @NotBlank @Size(max = 40) String mode,
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 500) String description,
        @NotBlank @Size(max = 4000) String instructions
) {
}
