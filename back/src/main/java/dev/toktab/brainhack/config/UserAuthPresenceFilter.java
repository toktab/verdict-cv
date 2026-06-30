package dev.toktab.brainhack.config;

import dev.toktab.brainhack.log.RequestIds;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class UserAuthPresenceFilter extends OncePerRequestFilter {
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return !(path.startsWith("/api/audit")
                || path.startsWith("/api/projects")
                || path.equals("/api/auth/me")
                || path.equals("/api/auth/logout"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!hasUserToken(request)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            String requestId = RequestIds.current(request);
            response.setHeader(RequestIds.HEADER, requestId);
            response.getWriter().write("{\"code\":\"UNAUTHORIZED\",\"message\":\"User authentication required\",\"requestId\":\"" + requestId + "\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean hasUserToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)
                && !authorization.substring(7).trim().isBlank()) {
            return true;
        }
        String legacyToken = request.getHeader("X-User-Token");
        if (legacyToken != null && !legacyToken.isBlank()) {
            return true;
        }
        String queryToken = request.getParameter("token");
        return queryToken != null && !queryToken.isBlank();
    }
}
