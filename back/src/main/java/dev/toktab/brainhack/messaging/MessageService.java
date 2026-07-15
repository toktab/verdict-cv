package dev.toktab.brainhack.messaging;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.messaging.MessageDtos.MessageRequest;
import dev.toktab.brainhack.messaging.MessageDtos.CandidateAttachment;
import dev.toktab.brainhack.messaging.MessageDtos.MessageResponse;
import dev.toktab.brainhack.messaging.MessageDtos.MessageUpdateRequest;
import dev.toktab.brainhack.realtime.RealtimeService;
import dev.toktab.brainhack.hiring.ProjectStateService;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectActivityRequest;
import java.util.List;
import java.util.Locale;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MessageService {
    private final AppMessageRepository messageRepository;
    private final MessageFileLogger messageFileLogger;
    private final UserAccountService userAccountService;
    private final RealtimeService realtimeService;
    private final ObjectMapper objectMapper;
    private final ProjectStateService projectStateService;
    private static final TypeReference<List<CandidateAttachment>> ATTACHMENTS = new TypeReference<>() {};

    public MessageService(AppMessageRepository messageRepository, MessageFileLogger messageFileLogger, UserAccountService userAccountService, RealtimeService realtimeService, ObjectMapper objectMapper, ProjectStateService projectStateService) {
        this.messageRepository = messageRepository;
        this.messageFileLogger = messageFileLogger;
        this.userAccountService = userAccountService;
        this.realtimeService = realtimeService;
        this.objectMapper = objectMapper;
        this.projectStateService = projectStateService;
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> messages(UserAccount actor) {
        return messageRepository.findMailbox(actor.getEmail(), actor.getId()).stream().map(this::toResponse).toList();
    }

    @Transactional
    public MessageResponse send(UserAccount actor, MessageRequest request) {
        AppMessage message = baseMessage(actor, request.to(), defaulted(request.subject(), "No subject"), request.body());
        validateReference(actor, request.replyToMessageId(), "Reply message");
        validateReference(actor, request.forwardedFromMessageId(), "Forwarded message");
        message.setReplyToMessageId(request.replyToMessageId());
        message.setForwardedFromMessageId(request.forwardedFromMessageId());
        message.setCandidateAttachmentsJson(writeAttachments(request.candidateAttachments()));
        message = messageRepository.save(message);
        recordCandidateMessages(actor, message, request.candidateAttachments());
        messageFileLogger.sent(actor, message);
        realtimeService.publishMessage(actor);
        userAccountService.findActiveByUsernameOrEmail(message.getRecipientEmail()).ifPresent(realtimeService::publishMessage);
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
            message.setReadAt(request.read() ? Instant.now() : null);
        }
        if (request.starred() != null) {
            message.setStarred(request.starred());
        }
        if (request.archived() != null) {
            message.setArchived(request.archived());
        }
        if (request.inviteStatus() != null && !request.inviteStatus().isBlank()) {
            message.setInviteStatus(request.inviteStatus().toUpperCase(Locale.ROOT));
        }
        AppMessage saved = messageRepository.save(message);
        messageFileLogger.updated(actor, saved);
        realtimeService.publishMessage(actor);
        userAccountService.findActiveByUsernameOrEmail(saved.getRecipientEmail()).ifPresent(realtimeService::publishMessage);
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
        realtimeService.publishMessage(actor);
        userAccountService.findActiveByUsernameOrEmail(saved.getRecipientEmail()).ifPresent(realtimeService::publishMessage);
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
                message.getReadAt(),
                message.isArchived(),
                "SENT",
                message.getReplyToMessageId(),
                message.getForwardedFromMessageId(),
                readAttachments(message.getCandidateAttachmentsJson()),
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

    private void validateReference(UserAccount actor, Long messageId, String label) {
        if (messageId == null) return;
        AppMessage referenced = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException(label + " not found"));
        if (!ownsMailboxMessage(actor, referenced)) {
            throw new IllegalArgumentException(label + " not found");
        }
    }

    private String writeAttachments(List<CandidateAttachment> attachments) {
        try {
            return objectMapper.writeValueAsString(attachments == null ? List.of() : attachments.stream().limit(20).toList());
        } catch (Exception exception) {
            throw new IllegalArgumentException("Could not save candidate attachments");
        }
    }

    private List<CandidateAttachment> readAttachments(String json) {
        try {
            return json == null || json.isBlank() ? List.of() : objectMapper.readValue(json, ATTACHMENTS);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private void recordCandidateMessages(UserAccount actor, AppMessage message, List<CandidateAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) return;
        Set<String> recorded = new HashSet<>();
        for (CandidateAttachment attachment : attachments.stream().limit(20).toList()) {
            if (attachment.projectId() == null || attachment.candidateId() == null) continue;
            String key = attachment.projectId() + ":" + attachment.candidateId();
            if (!recorded.add(key)) continue;
            projectStateService.record(actor, attachment.projectId(), new ProjectActivityRequest(
                    "candidate_message",
                    "Sent candidate package to " + message.getRecipientEmail(),
                    message.getRecipientEmail(), message.getRecipientEmail(), attachment.candidateId(),
                    defaulted(attachment.name(), "Candidate"), "info",
                    "Message #" + message.getId() + ": " + message.getSubject()));
        }
    }
}
