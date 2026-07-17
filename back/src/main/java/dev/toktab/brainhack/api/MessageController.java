package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.messaging.MessageDtos.MessageRequest;
import dev.toktab.brainhack.messaging.MessageDtos.MessageResponse;
import dev.toktab.brainhack.messaging.MessageDtos.MessagePageResponse;
import dev.toktab.brainhack.messaging.MessageDtos.MessageUpdateRequest;
import dev.toktab.brainhack.messaging.MessageService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/api/messages")
public class MessageController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final MessageService messageService;

    public MessageController(UserSessionService sessionService, AuthTokenResolver tokenResolver, MessageService messageService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.messageService = messageService;
    }

    @GetMapping
    public List<MessageResponse> messages(@RequestHeader(value = "Authorization", required = false) String authorization,
                                          @RequestHeader(value = "X-User-Token", required = false) String legacyToken) {
        return messageService.messages(owner(authorization, legacyToken));
    }

    @GetMapping("/page")
    public MessagePageResponse page(@RequestHeader(value = "Authorization", required = false) String authorization,
                                    @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "25") int size,
                                    @RequestParam(defaultValue = "") String search) {
        return messageService.messagePage(owner(authorization, legacyToken), page, size, search);
    }

    @PostMapping
    public MessageResponse send(@RequestHeader(value = "Authorization", required = false) String authorization,
                                @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                @Valid @RequestBody MessageRequest request) {
        return messageService.send(owner(authorization, legacyToken), request);
    }

    @PatchMapping("/{id}")
    public MessageResponse update(@RequestHeader(value = "Authorization", required = false) String authorization,
                                  @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                  @PathVariable Long id,
                                  @RequestBody MessageUpdateRequest request) {
        return messageService.update(owner(authorization, legacyToken), id, request);
    }

    private UserAccount owner(String authorization, String legacyToken) {
        return sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
