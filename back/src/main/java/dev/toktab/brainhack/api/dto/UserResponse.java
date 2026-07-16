package dev.toktab.brainhack.api.dto;

import java.time.Instant;

public record UserResponse(
        Long id,
        String fullName,
        String username,
        String email,
        String country,
        String address,
        String organization,
        String role,
        boolean emailVerified,
        boolean messageNotificationsEnabled,
        Instant messageNotificationsMutedUntil,
        Instant createdAt,
        Instant lastLoginAt
) {
}
