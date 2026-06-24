package dev.toktab.brainhack.log;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestLoggingFilter extends OncePerRequestFilter {
    private final AuditLogService logService;

    public RequestLoggingFilter(AuditLogService logService) {
        this.logService = logService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long started = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            String path = request.getRequestURI();
            if (!path.startsWith("/api/admin/logs")) {
                long duration = System.currentTimeMillis() - started;
                String detail = "query=" + sanitize(request.getQueryString()) + "; userAgent=" + sanitize(request.getHeader("User-Agent"));
                logService.record("HTTP_REQUEST", request, response.getStatus(), duration, "visitor", detail);
            }
        }
    }

    private String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.replaceAll("[\\r\\n\\t]", " ");
    }
}
