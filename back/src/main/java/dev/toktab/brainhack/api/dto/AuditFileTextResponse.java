package dev.toktab.brainhack.api.dto;

import java.util.List;

public record AuditFileTextResponse(
        String filename,
        String contentType,
        String text,
        List<String> warnings
) {
}
