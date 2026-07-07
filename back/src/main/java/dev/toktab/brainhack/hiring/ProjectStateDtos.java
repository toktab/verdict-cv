package dev.toktab.brainhack.hiring;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public class ProjectStateDtos {
    public record ProjectSettingsRequest(Map<String, Object> settings) {
    }

    public record ProjectSettingsResponse(
            Map<String, Object> settings,
            @JsonProperty("updated_at") Instant updatedAt
    ) {
    }

    public record ProjectActivityRequest(
            @Size(max = 80) String type,
            @NotBlank @Size(max = 220) String action,
            @JsonProperty("target_email") @Size(max = 160) String targetEmail,
            @JsonProperty("target_name") @Size(max = 160) String targetName,
            @JsonProperty("candidate_id") Long candidateId,
            @JsonProperty("candidate_name") @Size(max = 160) String candidateName,
            @Size(max = 40) String severity,
            @Size(max = 12000) String detail
    ) {
    }

    public record ProjectActivityResponse(
            Long id,
            String type,
            String action,
            @JsonProperty("actor_email") String actorEmail,
            @JsonProperty("actor_name") String actorName,
            @JsonProperty("target_email") String targetEmail,
            @JsonProperty("target_name") String targetName,
            @JsonProperty("candidate_id") Long candidateId,
            @JsonProperty("candidate_name") String candidateName,
            @JsonProperty("project_title") String projectTitle,
            String severity,
            String detail,
            @JsonProperty("created_at") Instant createdAt
    ) {
    }

    public record ProjectAtsTemplateRequest(
            @NotBlank @Size(max = 120) String id,
            @NotBlank @Size(max = 180) String name,
            @Size(max = 40) String visibility,
            boolean verified,
            Map<String, Object> template
    ) {
    }

    public record ProjectAtsTemplateResponse(
            Long serverId,
            String id,
            String name,
            String visibility,
            boolean verified,
            Map<String, Object> template,
            @JsonProperty("updated_at") Instant updatedAt
    ) {
    }

    public record ProjectMemberPermissionsRequest(
            @NotBlank @Size(max = 160) String email,
            @Size(max = 80) String role,
            List<String> permissions
    ) {
    }
}
