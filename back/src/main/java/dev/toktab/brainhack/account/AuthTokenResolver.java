package dev.toktab.brainhack.account;

import org.springframework.stereotype.Component;

@Component
public class AuthTokenResolver {
    public String userToken(String authorization, String legacyToken, String queryToken) {
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authorization.substring(7).trim();
        }
        if (legacyToken != null && !legacyToken.isBlank()) {
            return legacyToken.trim();
        }
        if (queryToken != null && !queryToken.isBlank()) {
            return queryToken.trim();
        }
        throw new IllegalArgumentException("User authentication required");
    }
}
