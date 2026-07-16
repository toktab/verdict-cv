package dev.toktab.brainhack.api.dto;

import java.time.Instant;

public record NotificationPreferencesRequest(
        boolean enabled,
        Instant mutedUntil
) {
}
