package dev.toktab.brainhack.config;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.log.RequestIds;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class UserAuthPresenceFilter extends OncePerRequestFilter {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;

    public UserAuthPresenceFilter(UserSessionService sessionService, AuthTokenResolver tokenResolver) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        if (!path.startsWith("/api/")) {
            return true;
        }
        return path.equals("/api/auth/login")
                || path.equals("/api/auth/register")
                || path.equals("/api/auth/refresh")
                || path.startsWith("/api/admin")
                || path.startsWith("/api/docs")
                || path.equals("/api/system/health")
                || path.equals("/api/telemetry")
                || path.startsWith("/v3/api-docs")
                || path.startsWith("/swagger-ui");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String token = tokenResolver.userToken(
                    request.getHeader("Authorization"),
                    request.getHeader("X-User-Token"),
                    request.getParameter("token"));
            UserAccount user = sessionService.me(token);
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(user, token, List.of()));
            filterChain.doFilter(request, response);
        } catch (IllegalArgumentException ex) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            String requestId = RequestIds.current(request);
            response.setHeader(RequestIds.HEADER, requestId);
            response.getWriter().write("{\"code\":\"UNAUTHORIZED\",\"message\":\"User authentication required\",\"requestId\":\"" + requestId + "\"}");
        }
    }
}
