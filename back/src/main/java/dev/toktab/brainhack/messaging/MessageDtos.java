package dev.toktab.brainhack.messaging;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

public final class MessageDtos {
    private MessageDtos() {
    }

    public record MessageRequest(
            @NotBlank @Size(max = 160) String to,
            @Size(max = 220) String subject,
            @NotBlank @Size(max = 20000) String body,
            @JsonProperty("reply_to_message_id") Long replyToMessageId,
            @JsonProperty("forwarded_from_message_id") Long forwardedFromMessageId,
            @JsonProperty("candidate_attachments") List<CandidateAttachment> candidateAttachments
    ) {
    }

    public record MessageUpdateRequest(
            @JsonProperty("read") Boolean read,
            Boolean starred,
            Boolean archived,
            @JsonProperty("invite_status") @Size(max = 40) String inviteStatus
    ) {
    }

    public record CandidateAttachment(
            @JsonProperty("candidate_id") Long candidateId,
            @JsonProperty("project_id") Long projectId,
            @Size(max = 160) String name,
            @Size(max = 180) String role,
            @JsonProperty("project_title") @Size(max = 220) String projectTitle,
            Integer score
    ) {
    }

    public record MessageResponse(
            Long id,
            String from,
            @JsonProperty("from_name") String fromName,
            String to,
            String subject,
            String body,
            String type,
            @JsonProperty("invite_token") String inviteToken,
            @JsonProperty("invite_status") String inviteStatus,
            @JsonProperty("project_id") Long projectId,
            @JsonProperty("project_title") String projectTitle,
            @JsonProperty("read") boolean read,
            boolean starred,
            @JsonProperty("read_at") Instant readAt,
            boolean archived,
            @JsonProperty("delivery_status") String deliveryStatus,
            @JsonProperty("reply_to_message_id") Long replyToMessageId,
            @JsonProperty("forwarded_from_message_id") Long forwardedFromMessageId,
            @JsonProperty("candidate_attachments") List<CandidateAttachment> candidateAttachments,
            @JsonProperty("created_at") Instant createdAt
    ) {
    }
}
