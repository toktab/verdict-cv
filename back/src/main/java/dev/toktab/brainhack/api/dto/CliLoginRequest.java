package dev.toktab.brainhack.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CliLoginRequest(
        @NotBlank @Size(max = 160) String identifier,
        @NotBlank @Size(max = 120) String password,
        @Size(max = 120) String clientName
) {
}
