package dev.toktab.brainhack.hiring;

import java.util.Locale;

public enum ProjectRole {
    VIEWER,
    VOTER,
    REVIEWER,
    SCREENER,
    COORDINATOR,
    ADMIN,
    ORGANIZATION_ADMIN,
    CUSTOM;

    public static ProjectRole from(String value) {
        if (value == null || value.isBlank()) return VIEWER;
        String normalized = value.trim()
                .replace('-', ' ').replace('_', ' ')
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", "_");
        // Handle display names
        if (normalized.contains("head_admin") || normalized.contains("organization_admin")) return ORGANIZATION_ADMIN;
        try {
            return ProjectRole.valueOf(normalized.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return VIEWER;
        }
    }

    public String displayName() {
        return switch (this) {
            case VIEWER -> "Viewer";
            case VOTER -> "Voter";
            case REVIEWER -> "Reviewer";
            case SCREENER -> "Screener";
            case COORDINATOR -> "Coordinator";
            case ADMIN -> "Admin";
            case ORGANIZATION_ADMIN -> "Head Admin";
            case CUSTOM -> "Custom";
        };
    }

    public boolean isAdminLevel() {
        return this == ADMIN || this == ORGANIZATION_ADMIN;
    }

    public boolean canManageTeam() {
        return isAdminLevel() || this == COORDINATOR;
    }
}
