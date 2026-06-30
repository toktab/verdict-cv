package dev.toktab.brainhack.messaging;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class MessageDtos {
    private MessageDtos() {
    }

    public record MessageRequest(
            @NotBlank @Size(max = 160) String to,
            @Size(max = 220) String subject,
            @NotBlank @Size(max = 20000) String body
    ) {
    }

    public record MessageUpdateRequest(
            @JsonProperty("read") Boolean read,
            Boolean starred,
            @JsonProperty("invite_status") @Size(max = 40) String inviteStatus
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
            @JsonProperty("created_at") Instant createdAt
    ) {
    }
}
