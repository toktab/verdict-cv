package dev.toktab.brainhack.realtime;

import dev.toktab.brainhack.account.UserAccount;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class RealtimeService {
    private static final long TIMEOUT_MILLIS = 30L * 60L * 1000L;
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final AtomicLong eventSequence = new AtomicLong();

    public SseEmitter subscribe(UserAccount user) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MILLIS);
        emitters.computeIfAbsent(user.getId(), ignored -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(user.getId(), emitter));
        emitter.onTimeout(() -> remove(user.getId(), emitter));
        emitter.onError(ignored -> remove(user.getId(), emitter));
        send(user.getId(), "ready", Map.of("type", "ready", "at", Instant.now().toString()));
        return emitter;
    }

    public void publishMessage(UserAccount user) {
        if (user != null) {
            send(user.getId(), "message", Map.of("type", "message", "at", Instant.now().toString()));
        }
    }

    public void publishProject(UserAccount user) {
        if (user != null) {
            send(user.getId(), "project", Map.of("type", "project", "at", Instant.now().toString()));
        }
    }

    public void publishProject(List<UserAccount> users) {
        users.forEach(this::publishProject);
    }

    public void publishAudit(UserAccount user, Long auditId, String status) {
        if (user != null) {
            send(user.getId(), "audit", Map.of("type", "audit", "auditId", auditId, "status", status, "at", Instant.now().toString()));
        }
    }

    private void send(Long userId, String eventName, Object body) {
        List<SseEmitter> rows = emitters.getOrDefault(userId, new CopyOnWriteArrayList<>());
        for (SseEmitter emitter : rows) {
            try {
                emitter.send(SseEmitter.event()
                        .id(Long.toString(eventSequence.incrementAndGet()))
                        .name(eventName)
                        .data(body));
            } catch (IOException | IllegalStateException exception) {
                remove(userId, emitter);
            }
        }
    }

    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        for (Long userId : List.copyOf(emitters.keySet())) {
            send(userId, "heartbeat", Map.of("type", "heartbeat", "at", Instant.now().toString()));
        }
    }

    private void remove(Long userId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> rows = emitters.get(userId);
        if (rows == null) {
            return;
        }
        rows.remove(emitter);
        if (rows.isEmpty()) {
            emitters.remove(userId, rows);
        }
    }
}
