package dev.toktab.brainhack.api.dto;

public record AuditFileTextResponse(
        String filename,
        String contentType,
        String text
) {
}
