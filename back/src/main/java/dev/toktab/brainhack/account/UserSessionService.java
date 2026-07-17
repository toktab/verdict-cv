package dev.toktab.brainhack.account;

import dev.toktab.brainhack.api.dto.LoginRequest;
import dev.toktab.brainhack.api.dto.RegisterRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Base64;
import java.util.List;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

@Service
public class UserSessionService {
    private final UserAccountRepository userRepository;
    private final AccountSettingsService settingsService;
    private final UserSessionRepository sessionRepository;
    private final CliPairingCodeRepository pairingCodeRepository;
    private final SecureRandom secureRandom = new SecureRandom();
    private static final char[] PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

    public UserSessionService(UserAccountRepository userRepository, AccountSettingsService settingsService, UserSessionRepository sessionRepository, CliPairingCodeRepository pairingCodeRepository) {
        this.userRepository = userRepository;
        this.settingsService = settingsService;
        this.sessionRepository = sessionRepository;
        this.pairingCodeRepository = pairingCodeRepository;
    }

    @Transactional
    public SessionResult register(RegisterRequest request) {
        return register(request, null);
    }

    @Transactional
    public SessionResult register(RegisterRequest request, HttpServletRequest httpRequest) {
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
            return new SessionResult("", "", null, null, saved);
        }
        saved.setLastLoginAt(Instant.now());
        return token(saved.getId(), httpRequest);
    }

    @Transactional
    public SessionResult login(LoginRequest request) {
        return login(request, null);
    }

    @Transactional
    public SessionResult login(LoginRequest request, HttpServletRequest httpRequest) {
        return login(request, httpRequest, "WEB", "Website");
    }

    @Transactional
    public SessionResult loginCli(LoginRequest request, String clientName, HttpServletRequest httpRequest) {
        return login(request, httpRequest, "CLI", defaulted(clientName, "VERDICT CLI"));
    }

    private SessionResult login(LoginRequest request, HttpServletRequest httpRequest, String clientType, String clientName) {
        String identifier = clean(request.identifier()).toLowerCase();
        UserAccount account = userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier)
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        if (account.getDeletedAt() != null) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        if (!BCrypt.checkpw(request.password(), account.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        if (settingsService.requireEmailVerification() && !account.isEmailVerified()) {
            throw new IllegalArgumentException("Email verification is required before login");
        }
        account.setLastLoginAt(Instant.now());
        userRepository.save(account);
        return token(account.getId(), httpRequest, clientType, clientName);
    }

    @Transactional
    public UserAccount me(String token) {
        UserSession session = sessionRepository.findById(token).orElseThrow(() -> new IllegalArgumentException("User authentication required"));
        if (session.getRevokedAt() != null || session.getExpiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("User authentication required");
        }
        if (session.getUser().getDeletedAt() != null) {
            throw new IllegalArgumentException("User authentication required");
        }
        session.setLastUsedAt(Instant.now());
        sessionRepository.save(session);
        return session.getUser();
    }

    @Transactional
    public SessionResult refresh(String refreshToken, HttpServletRequest httpRequest) {
        UserSession oldSession = sessionRepository.findByRefreshToken(refreshToken)
                .orElseThrow(() -> new IllegalArgumentException("Refresh session is invalid"));
        if (oldSession.getRevokedAt() != null || oldSession.getRefreshExpiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("Refresh session is invalid");
        }
        UserAccount account = oldSession.getUser();
        if (account.getDeletedAt() != null) {
            throw new IllegalArgumentException("Refresh session is invalid");
        }
        oldSession.setRevokedAt(Instant.now());
        oldSession.setRevocationReason("refresh rotated");
        sessionRepository.save(oldSession);
        return token(account.getId(), httpRequest, oldSession.getClientType(), oldSession.getClientName());
    }

    @Transactional
    public void logout(String token) {
        if (token != null) {
            sessionRepository.findById(token).ifPresent(session -> {
                session.setRevokedAt(Instant.now());
                session.setRevocationReason("user logout");
                sessionRepository.save(session);
            });
        }
    }

    @Transactional
    public List<CmdSessionView> cliSessions(UserAccount account) {
        Instant now = Instant.now();
        return sessionRepository.findByUserIdAndClientTypeOrderByLastUsedAtDesc(account.getId(), "CLI").stream()
                .filter(session -> !"refresh rotated".equals(session.getRevocationReason()))
                .map(session -> new CmdSessionView(
                        session.getSessionId(), session.getClientName(), session.getIpAddress(), session.getUserAgent(),
                        session.getCreatedAt(), session.getLastUsedAt(), session.getExpiresAt(), session.getRefreshExpiresAt(),
                        session.getRevokedAt(), session.getRevocationReason(),
                        session.getRevokedAt() == null && session.getRefreshExpiresAt().isAfter(now)))
                .toList();
    }

    @Transactional
    public PairingCodeView createCliPairingCode(UserAccount account, HttpServletRequest request) {
        pairingCodeRepository.deleteByUserIdAndUsedAtIsNull(account.getId());
        pairingCodeRepository.deleteByExpiresAtBefore(Instant.now().minus(Duration.ofDays(1)));
        String raw = randomPairingCode();
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(5));
        CliPairingCode pairingCode = new CliPairingCode();
        pairingCode.setCodeHash(hashPairingCode(raw));
        pairingCode.setUser(account);
        pairingCode.setExpiresAt(expiresAt);
        pairingCode.setRequestedFromIp(remoteAddress(request));
        pairingCodeRepository.save(pairingCode);
        return new PairingCodeView(formatPairingCode(raw), expiresAt, Duration.ofMinutes(5).toSeconds());
    }

    @Transactional
    public SessionResult pairCli(String code, String clientName, HttpServletRequest request) {
        String codeHash = hashPairingCode(code);
        CliPairingCode pairingCode = pairingCodeRepository.findAvailableForUpdate(codeHash)
                .orElseThrow(() -> new IllegalArgumentException("Pairing code is invalid, expired, or already used"));
        Instant now = Instant.now();
        if (!pairingCode.getExpiresAt().isAfter(now)) {
            pairingCode.setUsedAt(now);
            pairingCodeRepository.save(pairingCode);
            throw new IllegalArgumentException("Pairing code is invalid, expired, or already used");
        }
        UserAccount account = pairingCode.getUser();
        if (account.getDeletedAt() != null) {
            throw new IllegalArgumentException("Pairing code is invalid, expired, or already used");
        }
        pairingCode.setUsedAt(now);
        pairingCodeRepository.save(pairingCode);
        return token(account.getId(), request, "CLI", defaulted(clientName, "VERDICT CLI"));
    }

    @Transactional
    public void revokeCliSession(UserAccount account, String sessionId) {
        UserSession session = sessionRepository.findBySessionIdAndUserId(sessionId, account.getId())
                .orElseThrow(() -> new IllegalArgumentException("CMD session not found"));
        if (!"CLI".equals(session.getClientType())) {
            throw new IllegalArgumentException("CMD session not found");
        }
        if (session.getRevokedAt() == null) {
            session.setRevokedAt(Instant.now());
            session.setRevocationReason("revoked from profile");
            sessionRepository.save(session);
        }
    }

    @Transactional
    private SessionResult token(Long userId, HttpServletRequest httpRequest) {
        return token(userId, httpRequest, "WEB", "Website");
    }

    private SessionResult token(Long userId, HttpServletRequest httpRequest, String clientType, String clientName) {
        byte[] bytes = new byte[36];
        secureRandom.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        byte[] refreshBytes = new byte[48];
        secureRandom.nextBytes(refreshBytes);
        String refreshToken = Base64.getUrlEncoder().withoutPadding().encodeToString(refreshBytes);
        UserAccount account = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User account not found"));
        Instant now = Instant.now();
        UserSession session = new UserSession();
        session.setToken(token);
        session.setUser(account);
        session.setExpiresAt(now.plusSeconds(60L * 15L));
        session.setRefreshToken(refreshToken);
        session.setRefreshExpiresAt(now.plusSeconds(60L * 60L * 24L * 14L));
        session.setLastUsedAt(now);
        session.setUserAgent(clean(header(httpRequest, "User-Agent")));
        session.setIpAddress(remoteAddress(httpRequest));
        String normalizedClientType = defaulted(clientType, "WEB").toUpperCase();
        String normalizedClientName = defaulted(clientName, "Website");
        session.setClientType(normalizedClientType.substring(0, Math.min(normalizedClientType.length(), 16)));
        session.setClientName(normalizedClientName.substring(0, Math.min(normalizedClientName.length(), 120)));
        sessionRepository.deleteByExpiresAtBefore(now.minusSeconds(60L * 60L * 24L));
        sessionRepository.save(session);
        return new SessionResult(token, refreshToken, session.getExpiresAt(), session.getRefreshExpiresAt(), account);
    }

    private String header(HttpServletRequest request, String name) {
        return request == null ? "" : request.getHeader(name);
    }

    private String remoteAddress(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return clean(request.getRemoteAddr());
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String defaulted(String value, String fallback) {
        String clean = clean(value);
        return clean.isBlank() ? fallback : clean;
    }

    private String randomPairingCode() {
        StringBuilder result = new StringBuilder(8);
        for (int index = 0; index < 8; index += 1) {
            result.append(PAIRING_ALPHABET[secureRandom.nextInt(PAIRING_ALPHABET.length)]);
        }
        return result.toString();
    }

    private String formatPairingCode(String raw) {
        return raw.substring(0, 4) + "-" + raw.substring(4);
    }

    private String hashPairingCode(String code) {
        String normalized = clean(code).replace("-", "").toUpperCase();
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record SessionResult(String token, String refreshToken, Instant accessExpiresAt, Instant refreshExpiresAt, UserAccount account) {
    }

    public record PairingCodeView(String code, Instant expiresAt, long expiresInSeconds) {
    }

    public record CmdSessionView(
            String id,
            String clientName,
            String ipAddress,
            String userAgent,
            Instant createdAt,
            Instant lastUsedAt,
            Instant accessExpiresAt,
            Instant refreshExpiresAt,
            Instant revokedAt,
            String revocationReason,
            boolean active
    ) {
    }
}
