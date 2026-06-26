package dev.toktab.brainhack.api.dto;

import java.time.Instant;

public record AuditTemplateResponse(
        String id,
        String source,
        String mode,
        String name,
        String description,
        String instructions,
        Instant createdAt
) {
}
