package dev.toktab.brainhack.account;

import org.springframework.stereotype.Service;

@Service
public class UserTokenService {
    private final UserSessionService sessionService;

    public UserTokenService(UserSessionService sessionService) {
        this.sessionService = sessionService;
    }

    public UserAccount requireUser(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("User authentication required");
        }
        return sessionService.me(token);
    }
}
