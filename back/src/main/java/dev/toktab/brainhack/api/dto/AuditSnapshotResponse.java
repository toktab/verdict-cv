package dev.toktab.brainhack.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record AuditSnapshotResponse(
        Long id,
        @JsonProperty("audit_id") Long auditId,
        @JsonProperty("snapshot_fingerprint") String snapshotFingerprint,
        @JsonProperty("payload_json") String payloadJson,
        @JsonProperty("created_at") Instant createdAt
) {
}
