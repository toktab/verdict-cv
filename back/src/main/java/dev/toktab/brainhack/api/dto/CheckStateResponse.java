package dev.toktab.brainhack.api.dto;

public record CheckStateResponse(
        String id,
        String name,
        String description,
        String intensity,
        boolean paid
) {
}
