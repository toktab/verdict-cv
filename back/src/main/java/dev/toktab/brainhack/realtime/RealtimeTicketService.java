package dev.toktab.brainhack.realtime;

import dev.toktab.brainhack.account.UserAccount;
import jakarta.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import org.springframework.stereotype.Service;

@Service
public class RealtimeTicketService {
    private static final int TICKET_BYTES = 32;
    private static final long TICKET_MINUTES = 35;
    private final RealtimeTicketRepository repository;
    private final SecureRandom secureRandom = new SecureRandom();

    public RealtimeTicketService(RealtimeTicketRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public IssuedTicket issue(UserAccount user) {
        repository.deleteByExpiresAtBefore(Instant.now());
        byte[] bytes = new byte[TICKET_BYTES];
        secureRandom.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RealtimeTicket ticket = new RealtimeTicket();
        ticket.setUser(user);
        ticket.setTokenHash(hash(raw));
        ticket.setExpiresAt(Instant.now().plus(TICKET_MINUTES, ChronoUnit.MINUTES));
        RealtimeTicket saved = repository.save(ticket);
        return new IssuedTicket(raw, saved.getExpiresAt());
    }

    @Transactional
    public UserAccount resolve(String rawTicket) {
        if (rawTicket == null || rawTicket.isBlank()) {
            throw new IllegalArgumentException("Realtime ticket required");
        }
        return repository.findByTokenHashAndExpiresAtAfter(hash(rawTicket.trim()), Instant.now())
                .map(RealtimeTicket::getUser)
                .orElseThrow(() -> new IllegalArgumentException("Realtime ticket expired or invalid"));
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    public record IssuedTicket(String ticket, Instant expiresAt) {
    }
}

