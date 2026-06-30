package dev.toktab.brainhack.account;

import java.util.Locale;

public enum AccountRole {
    USER,
    REVIEWER,
    ORGANIZATION_ADMIN,
    SYSTEM_ADMIN;

    public static AccountRole from(String value) {
        if (value == null || value.isBlank()) {
            return USER;
        }
        String normalized = value.trim()
                .replace('-', '_')
                .replace(' ', '_')
                .toUpperCase(Locale.ROOT);
        try {
            return AccountRole.valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            return USER;
        }
    }

    public boolean atLeast(AccountRole required) {
        return ordinal() >= required.ordinal();
    }
}
