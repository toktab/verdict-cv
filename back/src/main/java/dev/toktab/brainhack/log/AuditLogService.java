package dev.toktab.brainhack.log;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Service;

@Service
public class AuditLogService {
    private static final AtomicInteger LOG_MANAGER = new AtomicInteger(0);

    private final AppEventLogRepository repository;

    public AuditLogService(AppEventLogRepository repository) {
        this.repository = repository;
    }

    public void record(String eventType, HttpServletRequest request, int statusCode, long durationMillis, String actor, String detail) {
        AppEventLog log = new AppEventLog();
        log.setSequence(LOG_MANAGER.incrementAndGet());
        log.setEventType(limit(eventType, 64));
        log.setIpAddress(limit(resolveIp(request), 45));
        log.setMethod(limit(Optional.ofNullable(request.getMethod()).orElse("N/A"), 12));
        log.setPath(limit(request.getRequestURI(), 500));
        log.setStatusCode(statusCode);
        log.setDurationMillis(durationMillis);
        log.setActor(limit(actor == null ? "anonymous" : actor, 120));
        log.setDetail(limit(detail == null ? "" : detail, 4000));
        repository.save(log);
    }

    public void recordSystem(String eventType, String detail) {
        AppEventLog log = new AppEventLog();
        log.setSequence(LOG_MANAGER.incrementAndGet());
        log.setEventType(limit(eventType, 64));
        log.setIpAddress("system");
        log.setMethod("SYSTEM");
        log.setPath("system");
        log.setStatusCode(200);
        log.setDurationMillis(0);
        log.setActor("system");
        log.setDetail(limit(detail, 4000));
        repository.save(log);
    }

    private String resolveIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    private String limit(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
