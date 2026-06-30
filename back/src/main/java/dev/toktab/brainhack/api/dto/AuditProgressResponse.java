package dev.toktab.brainhack.api.dto;

import dev.toktab.brainhack.audit.AuditStatus;
import java.time.Instant;

public record AuditProgressResponse(
        Long id,
        AuditStatus status,
        String stage,
        int percent,
        String message,
        long processingMillis,
        String engine,
        Instant createdAt
) {
}
