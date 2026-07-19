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

    public record ImportResponse(
            int imported,
            int skipped,
            int candidates,
            int members,
            int messages,
            int audits
    ) {
    }

    public record OsintRunRequest(
            String state,
            List<String> checks,
            boolean consent
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
            @JsonProperty("checked_at") Instant checkedAt,
            @JsonProperty("consented_checks") List<String> consentedChecks,
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
            @JsonProperty("owner_id") Long ownerId,
            @JsonProperty("my_role") String myRole,
            @JsonProperty("my_permissions") List<String> myPermissions,
            List<CandidateResponse> candidates
    ) {
    }

    public record ProjectPageResponse(
            List<ProjectResponse> items,
            int page,
            int size,
            long total,
            int totalPages
    ) {
    }

    public record CandidateResponse(
            Long id,
            String name,
            String email,
            String role,
            int score,
            int match,
            String risk,
            String state,
            String osint,
            String memory,
            @JsonProperty("analysis_state") String analysisState,
            @JsonProperty("analysis_engine") String analysisEngine,
            @JsonProperty("analysis_prompt_version") String analysisPromptVersion,
            @JsonProperty("analysis_completed_at") Instant analysisCompletedAt,
            @JsonProperty("prompt_tokens") int promptTokens,
            @JsonProperty("completion_tokens") int completionTokens,
            @JsonProperty("total_tokens") int totalTokens,
            @JsonProperty("estimated_cost_usd") java.math.BigDecimal estimatedCostUsd,
            @JsonProperty("initialized_analysis_states") List<String> initializedAnalysisStates,
            @JsonProperty("memory_history") List<Map<String, Object>> memoryHistory,
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

    public record CandidateAnalysisStateRequest(
            @NotBlank @Size(max = 40) String state,
            boolean initialize
    ) {
    }

    public record CandidatePageResponse(
            List<CandidateResponse> items,
            int offset,
            int limit,
            long total
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
            List<String> permissions,
            String status,
            String source,
            @JsonProperty("protected_member") boolean protectedMember
    ) {
    }

    public record MemberRoleRequest(
            @NotBlank @Size(max = 160) String email,
            @NotBlank @Size(max = 80) String role
    ) {
    }

    public record NoteRequest(
            @Size(max = 40) String type,
            @Size(max = 80) String decision,
            @NotBlank @Size(max = 12000) String body
    ) {
    }

    public record VoteRequest(
            @NotBlank @Size(max = 40) String action,
            Double score
    ) {
    }

    public record CandidateStatusRequest(
            @NotBlank @Size(max = 80) String status
    ) {
    }

    public record VoteSummaryResponse(
            String average,
            int downvotes,
            int stars,
            @JsonProperty("starred_by_me") boolean starredByMe,
            @JsonProperty("my_vote") String myVote,
            @JsonProperty("my_score") Double myScore,
            List<String> attribution
    ) {
    }

    public record ActivityResponse(
            Long id,
            String action,
            @JsonProperty("candidate_name") String candidateName,
            @JsonProperty("actor_name") String actorName,
            @JsonProperty("actor_email") String actorEmail,
            @JsonProperty("created_at") Instant createdAt
    ) {
    }

    public record CandidateWorkflowResponse(
            String status,
            @JsonProperty("vote_summary") VoteSummaryResponse voteSummary,
            List<ActivityResponse> activity
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
