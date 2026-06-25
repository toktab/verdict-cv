package dev.toktab.brainhack.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TelemetryRequest(
        @NotBlank @Size(max = 80) String action,
        @Size(max = 500) String target,
        @Size(max = 1000) String detail
) {
}
