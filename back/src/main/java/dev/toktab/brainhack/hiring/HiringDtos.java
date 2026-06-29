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

    public record ProjectResponse(
            Long id,
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
}
