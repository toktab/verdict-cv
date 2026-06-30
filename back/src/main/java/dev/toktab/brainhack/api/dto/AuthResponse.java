package dev.toktab.brainhack.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record AuthResponse(
        String token,
        @JsonProperty("access_token") String accessToken,
        @JsonProperty("refresh_token") String refreshToken,
        @JsonProperty("access_expires_at") Instant accessExpiresAt,
        @JsonProperty("refresh_expires_at") Instant refreshExpiresAt,
        UserResponse user
) {
}
