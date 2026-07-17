package dev.toktab.brainhack.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CliPairingRequest(
        @NotBlank
        @Pattern(regexp = "(?i)[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}", message = "pairing code format is invalid")
        String code,
        @Size(max = 120) String clientName
) {
}
