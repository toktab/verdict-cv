package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.account.UserMapper;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.api.dto.AuthResponse;
import dev.toktab.brainhack.api.dto.LoginRequest;
import dev.toktab.brainhack.api.dto.RegisterRequest;
import dev.toktab.brainhack.api.dto.UserProfileRequest;
import dev.toktab.brainhack.api.dto.UserResponse;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
        UserSessionService.SessionResult result = sessionService.register(request);
        logService.record("USER_REGISTER", httpRequest, 200, 0, result.account().getUsername(), "userId=" + result.account().getId());
        return new AuthResponse(result.token(), userMapper.toResponse(result.account()));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        UserSessionService.SessionResult result = sessionService.login(request);
        logService.record("USER_LOGIN", httpRequest, 200, 0, result.account().getUsername(), "userId=" + result.account().getId());
        return new AuthResponse(result.token(), userMapper.toResponse(result.account()));
    }

    @GetMapping("/me")
    public UserResponse me(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @RequestParam(value = "token", required = false) String queryToken) {
        return userMapper.toResponse(sessionService.me(tokenResolver.userToken(authorization, legacyToken, queryToken)));
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

    @PostMapping("/logout")
    public void logout(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken) {
        sessionService.logout(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
