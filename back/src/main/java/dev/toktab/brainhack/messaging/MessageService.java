package dev.toktab.brainhack.messaging;

import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.messaging.MessageDtos.MessageRequest;
import dev.toktab.brainhack.messaging.MessageDtos.MessageResponse;
import dev.toktab.brainhack.messaging.MessageDtos.MessageUpdateRequest;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MessageService {
    private final AppMessageRepository messageRepository;
    private final MessageFileLogger messageFileLogger;
    private final UserAccountService userAccountService;

    public MessageService(AppMessageRepository messageRepository, MessageFileLogger messageFileLogger, UserAccountService userAccountService) {
        this.messageRepository = messageRepository;
        this.messageFileLogger = messageFileLogger;
        this.userAccountService = userAccountService;
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> messages(UserAccount actor) {
        return messageRepository.findMailbox(actor.getEmail(), actor.getId()).stream().map(this::toResponse).toList();
    }

    @Transactional
    public MessageResponse send(UserAccount actor, MessageRequest request) {
        AppMessage message = baseMessage(actor, request.to(), defaulted(request.subject(), "No subject"), request.body());
        message.setReplyToMessageId(request.replyToMessageId());
        message.setForwardedFromMessageId(request.forwardedFromMessageId());
        message = messageRepository.save(message);
        messageFileLogger.sent(actor, message);
        return toResponse(message);
    }

    @Transactional
    public MessageResponse update(UserAccount actor, Long id, MessageUpdateRequest request) {
        AppMessage message = messageRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Message not found"));
        if (!ownsMailboxMessage(actor, message)) {
            throw new IllegalArgumentException("Message not found");
        }
        if (request.read() != null) {
            message.setRead(request.read());
        }
        if (request.starred() != null) {
            message.setStarred(request.starred());
        }
        if (request.inviteStatus() != null && !request.inviteStatus().isBlank()) {
            message.setInviteStatus(request.inviteStatus().toUpperCase(Locale.ROOT));
        }
        AppMessage saved = messageRepository.save(message);
        messageFileLogger.updated(actor, saved);
        return toResponse(saved);
    }

    @Transactional
    public AppMessage createInviteMessage(UserAccount actor, String to, String projectTitle, Long projectId, String inviteToken) {
        AppMessage message = baseMessage(
                actor,
                to,
                "Invitation to " + projectTitle,
                displayName(actor) + " invited you to join " + projectTitle + ". Open this message and choose Accept or Decline."
        );
        message.setType("PROJECT_INVITE");
        message.setInviteToken(inviteToken);
        message.setInviteStatus("PENDING");
        message.setProjectId(projectId);
        message.setProjectTitle(projectTitle);
        AppMessage saved = messageRepository.save(message);
        messageFileLogger.sent(actor, saved);
        return saved;
    }

    private AppMessage baseMessage(UserAccount actor, String to, String subject, String body) {
        UserAccount recipient = userAccountService.findActiveByUsernameOrEmail(to).orElse(null);
        String rawRecipient = defaulted(to, "").trim().toLowerCase(Locale.ROOT);
        if (recipient == null && !rawRecipient.contains("@")) {
            throw new IllegalArgumentException("Recipient user not found");
        }
        AppMessage message = new AppMessage();
        message.setSender(actor);
        message.setSenderEmail(actor.getEmail());
        message.setSenderName(displayName(actor));
        message.setRecipientEmail(recipient != null ? recipient.getEmail() : rawRecipient);
        message.setSubject(defaulted(subject, "No subject").trim());
        message.setBody(defaulted(body, "").trim());
        return message;
    }

    private boolean ownsMailboxMessage(UserAccount actor, AppMessage message) {
        return message.getSender().getId().equals(actor.getId()) || actor.getEmail().equalsIgnoreCase(message.getRecipientEmail());
    }

    private MessageResponse toResponse(AppMessage message) {
        return new MessageResponse(
                message.getId(),
                message.getSenderEmail(),
                message.getSenderName(),
                message.getRecipientEmail(),
                message.getSubject(),
                message.getBody(),
                message.getType(),
                message.getInviteToken(),
                message.getInviteStatus(),
                message.getProjectId(),
                message.getProjectTitle(),
                message.isRead(),
                message.isStarred(),
                message.getReplyToMessageId(),
                message.getForwardedFromMessageId(),
                message.getCreatedAt()
        );
    }

    private String displayName(UserAccount account) {
        if (account.getFullName() != null && !account.getFullName().isBlank()) {
            return account.getFullName();
        }
        return account.getUsername();
    }

    private String defaulted(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
