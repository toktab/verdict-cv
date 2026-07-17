package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.account.UserMapper;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.api.dto.AuthResponse;
import dev.toktab.brainhack.api.dto.LoginRequest;
import dev.toktab.brainhack.api.dto.CliLoginRequest;
import dev.toktab.brainhack.api.dto.CmdSessionResponse;
import dev.toktab.brainhack.api.dto.NotificationPreferencesRequest;
import dev.toktab.brainhack.api.dto.RefreshTokenRequest;
import dev.toktab.brainhack.api.dto.RegisterRequest;
import dev.toktab.brainhack.api.dto.UserProfileRequest;
import dev.toktab.brainhack.api.dto.UserResponse;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserSessionService sessionService;
    private final UserAccountService accountService;
    private final UserMapper userMapper;
    private final AuditLogService logService;
    private final AuthTokenResolver tokenResolver;

    public AuthController(UserSessionService sessionService, UserAccountService accountService, UserMapper userMapper, AuditLogService logService, AuthTokenResolver tokenResolver) {
        this.sessionService = sessionService;
        this.accountService = accountService;
        this.userMapper = userMapper;
        this.logService = logService;
        this.tokenResolver = tokenResolver;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        UserSessionService.SessionResult result = sessionService.register(request, httpRequest);
        logService.record("USER_REGISTER", httpRequest, 200, 0, result.account().getUsername(), "userId=" + result.account().getId());
        return response(result);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        UserSessionService.SessionResult result = sessionService.login(request, httpRequest);
        logService.record("USER_LOGIN", httpRequest, 200, 0, result.account().getUsername(), "userId=" + result.account().getId());
        return response(result);
    }

    @PostMapping("/cli/login")
    public AuthResponse cliLogin(@Valid @RequestBody CliLoginRequest request, HttpServletRequest httpRequest) {
        UserSessionService.SessionResult result = sessionService.loginCli(
                new LoginRequest(request.identifier(), request.password()), request.clientName(), httpRequest);
        logService.record("CLI_LOGIN", httpRequest, 200, 0, result.account().getUsername(),
                "userId=" + result.account().getId() + ", client=" + request.clientName());
        return response(result);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshTokenRequest request, HttpServletRequest httpRequest) {
        UserSessionService.SessionResult result = sessionService.refresh(request.refreshToken(), httpRequest);
        logService.record("USER_REFRESH", httpRequest, 200, 0, result.account().getUsername(), "userId=" + result.account().getId());
        return response(result);
    }

    @GetMapping("/me")
    public UserResponse me(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @RequestParam(value = "token", required = false) String queryToken) {
        return userMapper.toResponse(sessionService.me(tokenResolver.userToken(authorization, legacyToken, queryToken)));
    }

    @GetMapping("/users/lookup")
    public UserResponse lookupUser(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @RequestParam("q") String query) {
        sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
        return accountService.findActiveByUsernameOrEmail(query)
                .map(userMapper::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    @PatchMapping("/me")
    public UserResponse updateMe(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @Valid @RequestBody UserProfileRequest request,
            HttpServletRequest httpRequest) {
        UserAccount account = accountService.updateProfile(sessionService.me(tokenResolver.userToken(authorization, legacyToken, null)), request);
        logService.record("USER_PROFILE_UPDATE", httpRequest, 200, 0, account.getUsername(), "userId=" + account.getId());
        return userMapper.toResponse(account);
    }

    @GetMapping("/me/cmd-sessions")
    public List<CmdSessionResponse> cmdSessions(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken) {
        UserAccount account = sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
        return sessionService.cliSessions(account).stream()
                .map(session -> new CmdSessionResponse(
                        session.id(), session.clientName(), session.ipAddress(), session.userAgent(), session.createdAt(),
                        session.lastUsedAt(), session.accessExpiresAt(), session.refreshExpiresAt(), session.revokedAt(),
                        session.revocationReason(), session.active()))
                .toList();
    }

    @DeleteMapping("/me/cmd-sessions/{sessionId}")
    public void revokeCmdSession(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable String sessionId,
            HttpServletRequest httpRequest) {
        UserAccount account = sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
        sessionService.revokeCliSession(account, sessionId);
        logService.record("CLI_SESSION_REVOKE", httpRequest, 200, 0, account.getUsername(), "sessionId=" + sessionId);
    }

    @PatchMapping("/me/notifications")
    public UserResponse updateNotificationPreferences(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @RequestBody NotificationPreferencesRequest request,
            HttpServletRequest httpRequest) {
        UserAccount account = accountService.updateNotificationPreferences(
                sessionService.me(tokenResolver.userToken(authorization, legacyToken, null)),
                request.enabled(),
                request.mutedUntil());
        logService.record("USER_NOTIFICATION_PREFERENCES", httpRequest, 200, 0, account.getUsername(),
                "enabled=" + account.isMessageNotificationsEnabled() + ", mutedUntil=" + account.getMessageNotificationsMutedUntil());
        return userMapper.toResponse(account);
    }

    @PostMapping("/logout")
    public void logout(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken) {
        sessionService.logout(tokenResolver.userToken(authorization, legacyToken, null));
    }

    private AuthResponse response(UserSessionService.SessionResult result) {
        return new AuthResponse(
                result.token(),
                result.token(),
                result.refreshToken(),
                result.accessExpiresAt(),
                result.refreshExpiresAt(),
                userMapper.toResponse(result.account()));
    }
}
