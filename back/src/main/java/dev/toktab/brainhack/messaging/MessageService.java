package dev.toktab.brainhack.messaging;

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

    public MessageService(AppMessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> messages(UserAccount actor) {
        return messageRepository.findMailbox(actor.getEmail(), actor.getId()).stream().map(this::toResponse).toList();
    }

    @Transactional
    public MessageResponse send(UserAccount actor, MessageRequest request) {
        return toResponse(messageRepository.save(baseMessage(actor, request.to(), defaulted(request.subject(), "No subject"), request.body())));
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
        return toResponse(messageRepository.save(message));
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
        return messageRepository.save(message);
    }

    private AppMessage baseMessage(UserAccount actor, String to, String subject, String body) {
        AppMessage message = new AppMessage();
        message.setSender(actor);
        message.setSenderEmail(actor.getEmail());
        message.setSenderName(displayName(actor));
        message.setRecipientEmail(defaulted(to, "").trim().toLowerCase(Locale.ROOT));
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
