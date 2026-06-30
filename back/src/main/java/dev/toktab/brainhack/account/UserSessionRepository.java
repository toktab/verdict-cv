package dev.toktab.brainhack.account;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSessionRepository extends JpaRepository<UserSession, String> {
    void deleteByExpiresAtBefore(Instant now);
    Optional<UserSession> findByRefreshToken(String refreshToken);
}
