package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.hiring.HiringDtos.InviteResponse;
import dev.toktab.brainhack.hiring.ProjectInviteService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class InviteController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final ProjectInviteService inviteService;

    public InviteController(UserSessionService sessionService, AuthTokenResolver tokenResolver,
                            ProjectInviteService inviteService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.inviteService = inviteService;
    }

    @PostMapping("/invites/accept")
    public InviteResponse acceptInvite(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @RequestParam String token) {
        return inviteService.acceptInvite(owner(authorization, legacyToken), token);
    }

    private UserAccount owner(String authorization, String legacyToken) {
        return sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
