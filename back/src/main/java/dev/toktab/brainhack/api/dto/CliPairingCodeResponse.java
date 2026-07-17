package dev.toktab.brainhack.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record CliPairingCodeResponse(
        String code,
        @JsonProperty("expires_at") Instant expiresAt,
        @JsonProperty("expires_in_seconds") long expiresInSeconds
) {
}
