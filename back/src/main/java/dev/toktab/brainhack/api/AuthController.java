package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.api.dto.AuthResponse;
import dev.toktab.brainhack.api.dto.LoginRequest;
import dev.toktab.brainhack.api.dto.RegisterRequest;
import dev.toktab.brainhack.api.dto.UserResponse;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserSessionService sessionService;
    private final AuditLogService logService;

    public AuthController(UserSessionService sessionService, AuditLogService logService) {
        this.sessionService = sessionService;
        this.logService = logService;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        UserSessionService.SessionResult result = sessionService.register(request);
        logService.record("USER_REGISTER", httpRequest, 200, 0, result.account().getUsername(), "userId=" + result.account().getId());
        return new AuthResponse(result.token(), toResponse(result.account()));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        UserSessionService.SessionResult result = sessionService.login(request);
        logService.record("USER_LOGIN", httpRequest, 200, 0, result.account().getUsername(), "userId=" + result.account().getId());
        return new AuthResponse(result.token(), toResponse(result.account()));
    }

    @GetMapping("/me")
    public UserResponse me(@RequestHeader("X-User-Token") String token) {
        return toResponse(sessionService.me(token));
    }

    @PostMapping("/logout")
    public void logout(@RequestHeader(value = "X-User-Token", required = false) String token) {
        sessionService.logout(token);
    }

    private UserResponse toResponse(UserAccount account) {
        return new UserResponse(
                account.getId(),
                account.getFullName(),
                account.getUsername(),
                account.getEmail(),
                account.getCountry(),
                account.getAddress(),
                account.getOrganization(),
                account.getRole(),
                account.getCreatedAt(),
                account.getLastLoginAt()
        );
    }
}
