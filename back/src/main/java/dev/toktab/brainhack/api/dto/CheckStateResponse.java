package dev.toktab.brainhack.api.dto;

import java.util.List;

public record CheckStateResponse(
        String id,
        String name,
        String description,
        String intensity,
        boolean paid,
        String strategy,
        boolean requiresLlm,
        boolean aiConfigured,
        String availabilityMessage,
        List<String> capabilities
) {
}
