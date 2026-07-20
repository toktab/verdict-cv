package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.realtime.RealtimeService;
import dev.toktab.brainhack.realtime.RealtimeTicketService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
    private final RealtimeTicketService ticketService;

    public RealtimeController(UserSessionService sessionService, AuthTokenResolver tokenResolver, RealtimeService realtimeService,
                              RealtimeTicketService ticketService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.realtimeService = realtimeService;
        this.ticketService = ticketService;
    }

    @PostMapping("/ticket")
    public Map<String, Object> ticket(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken) {
        UserAccount user = sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
        RealtimeTicketService.IssuedTicket issued = ticketService.issue(user);
        return Map.of("ticket", issued.ticket(), "expiresAt", issued.expiresAt());
    }

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam("ticket") String ticket,
                             @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {
        UserAccount user = ticketService.resolve(ticket);
        return realtimeService.subscribe(user);
    }
}
