package dev.toktab.brainhack.hiring;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public class HiringDtos {
    public record ProjectRequest(
            @NotBlank @Size(max = 180) String title,
            @Size(max = 120) String department,
            @Size(max = 120) String location,
            @Size(max = 12000) String description,
            List<String> requirements,
            @Size(max = 80) String state,
            @Size(max = 80) String status
    ) {
    }

    public record CandidateRequest(
            @NotBlank @Size(max = 160) String name,
            @Size(max = 160) String role,
            @JsonProperty("cv_text") @Size(max = 30000) String cvText
    ) {
    }

    public record ImportResponse(int imported, int skipped) {
    }

    public record OsintRunRequest(
            String state,
            List<String> checks
    ) {
    }

    public record OsintSourceResponse(
            String source,
            String finding,
            int confidence,
            String impact,
            String tone,
            String url
    ) {
    }

    public record OsintRunResponse(
            String state,
            String status,
            int identityConfidence,
            int corroboratedSources,
            int contradictions,
            List<String> discoveredLinks,
            List<String> discoveredUsernames,
            List<OsintSourceResponse> sources
    ) {
    }

    public record ProjectResponse(
            Long id,
            @JsonProperty("organization_id") Long organizationId,
            String title,
            String department,
            String location,
            String description,
            List<String> requirements,
            String state,
            String status,
            @JsonProperty("opened_at") Instant openedAt,
            @JsonProperty("created_at") Instant createdAt,
            List<CandidateResponse> candidates
    ) {
    }

    public record CandidateResponse(
            Long id,
            String name,
            String role,
            int score,
            int match,
            String risk,
            String state,
            String osint,
            String memory,
            @JsonProperty("cv_text") String cvText,
            @JsonProperty("resume_filename") String resumeFilename,
            @JsonProperty("core_candidate_id") String coreCandidateId,
            @JsonProperty("cv_id") String cvId,
            @JsonProperty("verification_case_id") String verificationCaseId,
            @JsonProperty("submitted_at") Instant submittedAt,
            int flags,
            int supported,
            int stretched,
            int unsupported,
            String summary,
            List<List<String>> claims,
            @JsonProperty("audit_phrase_matches") List<Map<String, Object>> auditPhraseMatches
    ) {
    }

    public record InviteRequest(
            @NotBlank @Size(max = 160) String email,
            @Size(max = 80) String role
    ) {
    }

    public record InviteResponse(
            Long id,
            @JsonProperty("project_id") Long projectId,
            String email,
            String role,
            String token,
            String status,
            @JsonProperty("created_at") Instant createdAt,
            @JsonProperty("accepted_at") Instant acceptedAt
    ) {
    }

    public record ProjectMemberResponse(
            Long id,
            String name,
            String email,
            String role,
            String status,
            String source,
            @JsonProperty("protected_member") boolean protectedMember
    ) {
    }

    public record NoteRequest(
            @Size(max = 40) String type,
            @Size(max = 80) String decision,
            @NotBlank @Size(max = 12000) String body
    ) {
    }

    public record NoteResponse(
            Long id,
            String type,
            String decision,
            String body,
            @JsonProperty("author_id") Long authorId,
            @JsonProperty("author_name") String authorName,
            @JsonProperty("author_email") String authorEmail,
            @JsonProperty("created_at") Instant createdAt
    ) {
    }
}
