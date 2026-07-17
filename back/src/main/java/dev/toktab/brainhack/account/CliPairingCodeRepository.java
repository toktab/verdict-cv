package dev.toktab.brainhack.account;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CliPairingCodeRepository extends JpaRepository<CliPairingCode, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select code from CliPairingCode code join fetch code.user where code.codeHash = :codeHash and code.usedAt is null")
    Optional<CliPairingCode> findAvailableForUpdate(@Param("codeHash") String codeHash);

    void deleteByUserIdAndUsedAtIsNull(Long userId);
    void deleteByExpiresAtBefore(Instant cutoff);
}
