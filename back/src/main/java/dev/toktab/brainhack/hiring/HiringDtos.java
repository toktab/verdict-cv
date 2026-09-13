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
            Map<String, Object> rubric,
            @Size(max = 80) String state,
            @Size(max = 80) String status
    ) {
        public ProjectRequest(
                String title,
                String department,
                String location,
                String description,
                List<String> requirements,
                String state,
                String status) {
            this(title, department, location, description, requirements, Map.of(), state, status);
        }
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
            String url,
            String scenario
    ) {
        public OsintSourceResponse(String source, String finding, int confidence, String impact, String tone, String url) {
            this(source, finding, confidence, impact, tone, url, "");
        }
    }

    public record GithubLanguageResponse(
            String name,
            int repositories,
            long bytes,
            int percentage
    ) {
    }

    public record GithubRepositoryResponse(
            String name,
            String description,
            String url,
            String language,
            int stars,
            int forks,
            @JsonProperty("open_issues") int openIssues,
            @JsonProperty("size_kb") int sizeKb,
            boolean fork,
            boolean archived,
            @JsonProperty("default_branch") String defaultBranch,
            @JsonProperty("owner_login") String ownerLogin,
            @JsonProperty("language_bytes") Map<String, Long> languageBytes,
            @JsonProperty("readme_excerpt") String readmeExcerpt,
            @JsonProperty("created_at") Instant createdAt,
            @JsonProperty("updated_at") Instant updatedAt,
            @JsonProperty("pushed_at") Instant pushedAt,
            List<String> topics
    ) {
    }

    public record GithubProfileResponse(
            String username,
            String name,
            @JsonProperty("avatar_url") String avatarUrl,
            @JsonProperty("profile_url") String profileUrl,
            String bio,
            String company,
            String location,
            String blog,
            @JsonProperty("public_repos") int publicRepos,
            int followers,
            int following,
            @JsonProperty("created_at") Instant createdAt,
            @JsonProperty("updated_at") Instant updatedAt,
            @JsonProperty("latest_activity_at") Instant latestActivityAt,
            @JsonProperty("repository_depth_score") int repositoryDepthScore,
            List<GithubLanguageResponse> languages,
            List<GithubRepositoryResponse> repositories
    ) {
    }

    public record GithubJobMatchResponse(
            int score,
            String label,
            String summary,
            @JsonProperty("matched_terms") List<String> matchedTerms,
            @JsonProperty("missing_terms") List<String> missingTerms
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
            List<OsintSourceResponse> sources,
            GithubProfileResponse github,
            @JsonProperty("github_job_match") GithubJobMatchResponse githubJobMatch
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
            Map<String, Object> rubric,
            String state,
            String status,
            @JsonProperty("opened_at") Instant openedAt,
            @JsonProperty("created_at") Instant createdAt,
            @JsonProperty("owner_id") Long ownerId,
            @JsonProperty("my_role") String myRole,
            @JsonProperty("my_permissions") List<String> myPermissions,
            Map<String, Object> settings,
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
            @JsonProperty("fit_score") int fitScore,
            @JsonProperty("evidence_score") int evidenceScore,
            @JsonProperty("github_match_score") int githubMatchScore,
            @JsonProperty("reviewer_score") int reviewerScore,
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
            @JsonProperty("audit_phrase_matches") List<Map<String, Object>> auditPhraseMatches,
            @JsonProperty("analysis_runs") List<CandidateAnalysisRunResponse> analysisRuns
    ) {
    }

    public record CandidateAnalysisRunResponse(
            Long id,
            @JsonProperty("state_id") String stateId,
            String engine,
            @JsonProperty("prompt_version") String promptVersion,
            @JsonProperty("resume_fingerprint") String resumeFingerprint,
            @JsonProperty("template_fingerprint") String templateFingerprint,
            @JsonProperty("recommendation_score") int recommendationScore,
            @JsonProperty("fit_score") int fitScore,
            @JsonProperty("evidence_score") int evidenceScore,
            @JsonProperty("github_match_score") int githubMatchScore,
            @JsonProperty("reviewer_score") int reviewerScore,
            int supported,
            int stretched,
            int unsupported,
            @JsonProperty("prompt_tokens") int promptTokens,
            @JsonProperty("completion_tokens") int completionTokens,
            @JsonProperty("estimated_cost_usd") java.math.BigDecimal estimatedCostUsd,
            @JsonProperty("triggered_by") String triggeredBy,
            @JsonProperty("created_at") Instant createdAt
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
            @NotBlank @Size(max = 80) String status,
            @Size(max = 2000) String reason
    ) {
        public CandidateStatusRequest(String status) {
            this(status, "");
        }
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
