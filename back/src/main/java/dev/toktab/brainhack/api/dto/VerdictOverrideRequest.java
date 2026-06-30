package dev.toktab.brainhack.api.dto;

import dev.toktab.brainhack.audit.VerdictStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record VerdictOverrideRequest(
        @NotNull VerdictStatus status,
        @NotBlank @Size(max = 12000) String reason
) {
}
