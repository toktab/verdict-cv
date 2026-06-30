package dev.toktab.brainhack.admin;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

@Service
public class AdminSessionService {
    private final String username;
    private final String passwordHash;
    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, Instant> sessions = new ConcurrentHashMap<>();

    public AdminSessionService(
            @Value("${verdict.admin.username}") String username,
            @Value("${verdict.admin.password}") String password,
            @Value("${verdict.admin.allow-default-credentials:false}") boolean allowDefaultCredentials) {
        if (!allowDefaultCredentials && "admin".equals(username) && "admin".equals(password)) {
            throw new IllegalStateException("Default admin credentials are disabled. Set VERDICT_ADMIN_USERNAME and VERDICT_ADMIN_PASSWORD.");
        }
        this.username = username;
        this.passwordHash = BCrypt.hashpw(password, BCrypt.gensalt(10));
    }

    public String login(String providedUsername, String providedPassword) {
        if (!username.equals(providedUsername) || !BCrypt.checkpw(providedPassword, passwordHash)) {
            throw new IllegalArgumentException("Invalid admin credentials");
        }
        byte[] bytes = new byte[36];
        secureRandom.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.put(token, Instant.now().plusSeconds(60 * 60 * 12));
        return token;
    }

    public boolean isValid(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        Instant expiresAt = sessions.get(token);
        if (expiresAt == null) {
            return false;
        }
        if (expiresAt.isBefore(Instant.now())) {
            sessions.remove(token);
            return false;
        }
        return true;
    }

    public String username() {
        return username;
    }
}
