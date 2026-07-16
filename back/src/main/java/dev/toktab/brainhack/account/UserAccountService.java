package dev.toktab.brainhack.account;

import dev.toktab.brainhack.api.dto.UserAdminRequest;
import dev.toktab.brainhack.api.dto.UserProfileRequest;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

@Service
public class UserAccountService {
    private final UserAccountRepository userRepository;

    public UserAccountService(UserAccountRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<UserAccount> users() {
        return userRepository.findAll().stream()
                .filter(user -> user.getDeletedAt() == null)
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();
    }

    public List<UserAccount> users(String search) {
        return users(search, 0, 250);
    }

    public List<UserAccount> users(String search, int offset, int limit) {
        String needle = clean(search);
        Pageable pageable = page(offset, limit);
        if (needle.isBlank()) {
            return userRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable);
        }
        return userRepository.search(needle, pageable);
    }

    public Optional<UserAccount> findActiveByUsernameOrEmail(String identifier) {
        String value = clean(identifier).toLowerCase(Locale.ROOT);
        if (value.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(value, value)
                .filter(user -> user.getDeletedAt() == null);
    }

    @Transactional
    public UserAccount create(UserAdminRequest request) {
        String username = clean(request.username()).toLowerCase();
        String email = clean(request.email()).toLowerCase();
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Username is already taken");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email is already registered");
        }
        if (request.password() == null || request.password().length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
        UserAccount account = new UserAccount();
        apply(account, request);
        account.setUsername(username);
        account.setEmail(email);
        account.setPasswordHash(BCrypt.hashpw(request.password(), BCrypt.gensalt(11)));
        account.setEmailVerified(request.emailVerified());
        return userRepository.save(account);
    }

    @Transactional
    public UserAccount update(Long id, UserAdminRequest request) {
        UserAccount account = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        String username = clean(request.username()).toLowerCase();
        String email = clean(request.email()).toLowerCase();
        if (!account.getUsername().equalsIgnoreCase(username) && userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Username is already taken");
        }
        if (!account.getEmail().equalsIgnoreCase(email) && userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email is already registered");
        }
        apply(account, request);
        account.setUsername(username);
        account.setEmail(email);
        account.setEmailVerified(request.emailVerified());
        if (request.password() != null && !request.password().isBlank()) {
            if (request.password().length() < 8) {
                throw new IllegalArgumentException("Password must be at least 8 characters");
            }
            account.setPasswordHash(BCrypt.hashpw(request.password(), BCrypt.gensalt(11)));
        }
        return userRepository.save(account);
    }

    @Transactional
    public void delete(Long id) {
        UserAccount account = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        account.setDeletedAt(Instant.now());
        userRepository.save(account);
    }

    @Transactional
    public UserAccount updateProfile(UserAccount account, UserProfileRequest request) {
        String email = clean(request.email()).toLowerCase();
        if (!account.getEmail().equalsIgnoreCase(email) && userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email is already registered");
        }
        account.setFullName(clean(request.fullName()));
        account.setEmail(email);
        account.setCountry(clean(request.country()));
        account.setAddress(clean(request.address()));
        account.setOrganization(defaulted(request.organization(), "Independent"));
        account.setRole(defaulted(request.role(), "Analyst"));
        if (request.password() != null && !request.password().isBlank()) {
            if (request.password().length() < 8) {
                throw new IllegalArgumentException("Password must be at least 8 characters");
            }
            account.setPasswordHash(BCrypt.hashpw(request.password(), BCrypt.gensalt(11)));
        }
        return userRepository.save(account);
    }

    @Transactional
    public UserAccount updateNotificationPreferences(UserAccount account, boolean enabled, Instant mutedUntil) {
        if (mutedUntil != null && mutedUntil.isBefore(Instant.now())) {
            mutedUntil = null;
        }
        account.setMessageNotificationsEnabled(enabled);
        account.setMessageNotificationsMutedUntil(enabled ? mutedUntil : null);
        return userRepository.save(account);
    }

    private void apply(UserAccount account, UserAdminRequest request) {
        account.setFullName(clean(request.fullName()));
        account.setCountry(clean(request.country()));
        account.setAddress(clean(request.address()));
        account.setOrganization(defaulted(request.organization(), "Independent"));
        account.setRole(defaulted(request.role(), "Analyst"));
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String defaulted(String value, String fallback) {
        String clean = clean(value);
        return clean.isBlank() ? fallback : clean;
    }

    private Pageable page(int offset, int limit) {
        int size = Math.min(Math.max(limit, 1), 100);
        int page = Math.max(offset, 0) / size;
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    }
}
