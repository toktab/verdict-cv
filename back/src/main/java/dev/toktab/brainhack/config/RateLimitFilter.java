package dev.toktab.brainhack.config;

import dev.toktab.brainhack.log.RequestIds;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private final boolean enabled;
    private final long windowMillis;
    private final int authRequests;
    private final int auditRequests;
    private final int adminRequests;
    private final Clock clock;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Autowired
    public RateLimitFilter(
            @Value("${verdict.rate-limit.enabled:true}") boolean enabled,
            @Value("${verdict.rate-limit.window-seconds:60}") long windowSeconds,
            @Value("${verdict.rate-limit.auth-requests:10}") int authRequests,
            @Value("${verdict.rate-limit.audit-requests:20}") int auditRequests,
            @Value("${verdict.rate-limit.admin-requests:60}") int adminRequests) {
        this(enabled, windowSeconds, authRequests, auditRequests, adminRequests, Clock.systemUTC());
    }

    RateLimitFilter(boolean enabled, long windowSeconds, int authRequests, int auditRequests, int adminRequests, Clock clock) {
        this.enabled = enabled;
        this.windowMillis = Math.max(1, windowSeconds) * 1000;
        this.authRequests = Math.max(1, authRequests);
        this.auditRequests = Math.max(1, auditRequests);
        this.adminRequests = Math.max(1, adminRequests);
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || HttpMethod.OPTIONS.matches(request.getMethod()) || bucketFor(request) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String bucketName = bucketFor(request);
        String key = bucketName + ":" + clientKey(request);
        int limit = limitFor(bucketName);
        Bucket bucket = buckets.compute(key, (ignored, current) -> nextBucket(current, limit));
        response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, limit - bucket.count)));
        if (bucket.count > limit) {
            response.setStatus(429);
            response.setContentType("application/json");
            String requestId = RequestIds.current(request);
            response.setHeader(RequestIds.HEADER, requestId);
            response.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\",\"requestId\":\"" + requestId + "\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private Bucket nextBucket(Bucket current, int limit) {
        long now = clock.millis();
        if (current == null || now - current.windowStartedAt >= windowMillis) {
            return new Bucket(now, 1);
        }
        return new Bucket(current.windowStartedAt, current.count + 1);
    }

    private String bucketFor(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.equals("/api/auth/login") || path.equals("/api/auth/register")) {
            return "auth";
        }
        if (path.startsWith("/api/audit") || path.contains("/osint/run")) {
            return "audit";
        }
        if (path.startsWith("/api/admin")) {
            return "admin";
        }
        return null;
    }

    private int limitFor(String bucketName) {
        return switch (bucketName) {
            case "auth" -> authRequests;
            case "audit" -> auditRequests;
            case "admin" -> adminRequests;
            default -> auditRequests;
        };
    }

    private String clientKey(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private record Bucket(long windowStartedAt, int count) {
    }
}
