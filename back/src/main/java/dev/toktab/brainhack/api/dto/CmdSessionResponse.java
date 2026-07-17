package dev.toktab.brainhack.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record CmdSessionResponse(
        String id,
        @JsonProperty("client_name") String clientName,
        @JsonProperty("ip_address") String ipAddress,
        @JsonProperty("user_agent") String userAgent,
        @JsonProperty("created_at") Instant createdAt,
        @JsonProperty("last_used_at") Instant lastUsedAt,
        @JsonProperty("access_expires_at") Instant accessExpiresAt,
        @JsonProperty("refresh_expires_at") Instant refreshExpiresAt,
        @JsonProperty("revoked_at") Instant revokedAt,
        @JsonProperty("revocation_reason") String revocationReason,
        boolean active
) {
}
