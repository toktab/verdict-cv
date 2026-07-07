package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.realtime.RealtimeService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/realtime")
public class RealtimeController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final RealtimeService realtimeService;

    public RealtimeController(UserSessionService sessionService, AuthTokenResolver tokenResolver, RealtimeService realtimeService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.realtimeService = realtimeService;
    }

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestHeader(value = "Authorization", required = false) String authorization,
                             @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                             @RequestParam(value = "token", required = false) String queryToken) {
        UserAccount user = sessionService.me(tokenResolver.userToken(authorization, legacyToken, queryToken));
        return realtimeService.subscribe(user);
    }
}
