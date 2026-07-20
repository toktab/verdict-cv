package dev.toktab.brainhack.realtime;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RealtimeTicketRepository extends JpaRepository<RealtimeTicket, Long> {
    Optional<RealtimeTicket> findByTokenHashAndExpiresAtAfter(String tokenHash, Instant now);

    long deleteByExpiresAtBefore(Instant cutoff);
}

