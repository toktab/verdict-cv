package dev.toktab.brainhack.account;

import dev.toktab.brainhack.api.dto.LoginRequest;
import dev.toktab.brainhack.api.dto.RegisterRequest;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

@Service
public class UserSessionService {
    private final UserAccountRepository userRepository;
    private final AccountSettingsService settingsService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, Long> sessions = new ConcurrentHashMap<>();

    public UserSessionService(UserAccountRepository userRepository, AccountSettingsService settingsService) {
        this.userRepository = userRepository;
        this.settingsService = settingsService;
    }

    @Transactional
    public SessionResult register(RegisterRequest request) {
        String username = clean(request.username()).toLowerCase();
        String email = clean(request.email()).toLowerCase();
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Username is already taken");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email is already registered");
        }
        UserAccount account = new UserAccount();
        account.setFullName(clean(request.fullName()));
        account.setUsername(username);
        account.setEmail(email);
        account.setCountry(clean(request.country()));
        account.setAddress(clean(request.address()));
        account.setOrganization(defaulted(request.organization(), "Independent"));
        account.setRole(defaulted(request.role(), "Analyst"));
        account.setEmailVerified(!settingsService.requireEmailVerification());
        account.setPasswordHash(BCrypt.hashpw(request.password(), BCrypt.gensalt(11)));
        UserAccount saved = userRepository.save(account);
        if (!saved.isEmailVerified()) {
            return new SessionResult("", saved);
        }
        saved.setLastLoginAt(Instant.now());
        return new SessionResult(token(saved.getId()), saved);
    }

    @Transactional
    public SessionResult login(LoginRequest request) {
        String identifier = clean(request.identifier()).toLowerCase();
        UserAccount account = userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier)
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        if (!BCrypt.checkpw(request.password(), account.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        if (settingsService.requireEmailVerification() && !account.isEmailVerified()) {
            throw new IllegalArgumentException("Email verification is required before login");
        }
        account.setLastLoginAt(Instant.now());
        return new SessionResult(token(account.getId()), userRepository.save(account));
    }

    public UserAccount me(String token) {
        Long userId = sessions.get(token);
        if (userId == null) {
            throw new IllegalArgumentException("User authentication required");
        }
        return userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User account not found"));
    }

    public void logout(String token) {
        if (token != null) {
            sessions.remove(token);
        }
    }

    private String token(Long userId) {
        byte[] bytes = new byte[36];
        secureRandom.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.put(token, userId);
        return token;
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String defaulted(String value, String fallback) {
        String clean = clean(value);
        return clean.isBlank() ? fallback : clean;
    }

    public record SessionResult(String token, UserAccount account) {
    }
}
