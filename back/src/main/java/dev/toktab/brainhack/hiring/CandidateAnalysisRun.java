package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "candidate_analysis_runs",
        indexes = {
                @Index(name = "idx_candidate_analysis_runs_candidate", columnList = "candidate_id, created_at"),
                @Index(name = "idx_candidate_analysis_runs_project", columnList = "project_id, created_at")
        }
)
public class CandidateAnalysisRun {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private HiringCandidate candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private HiringProject project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "triggered_by_id")
    private UserAccount triggeredBy;

    @Column(nullable = false, length = 40)
    private String stateId;

    @Column(nullable = false, length = 180)
    private String engine;

    @Column(nullable = false, length = 120)
    private String promptVersion;

    @Column(nullable = false, length = 64)
    private String resumeFingerprint;

    @Column(nullable = false, length = 64)
    private String templateFingerprint;

    @Column(nullable = false)
    private int recommendationScore;

    @Column(nullable = false)
    private int fitScore;

    @Column(nullable = false)
    private int evidenceScore;

    @Column(nullable = false)
    private int githubMatchScore;

    @Column(nullable = false)
    private int reviewerScore;

    @Column(nullable = false)
    private int supported;

    @Column(nullable = false)
    private int stretched;

    @Column(nullable = false)
    private int unsupported;

    @Column(nullable = false)
    private int promptTokens;

    @Column(nullable = false)
    private int completionTokens;

    @Column(nullable = false, precision = 14, scale = 6)
    private BigDecimal estimatedCostUsd = BigDecimal.ZERO;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String claimsJson;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public HiringCandidate getCandidate() { return candidate; }
    public void setCandidate(HiringCandidate candidate) { this.candidate = candidate; }
    public HiringProject getProject() { return project; }
    public void setProject(HiringProject project) { this.project = project; }
    public UserAccount getTriggeredBy() { return triggeredBy; }
    public void setTriggeredBy(UserAccount triggeredBy) { this.triggeredBy = triggeredBy; }
    public String getStateId() { return stateId; }
    public void setStateId(String stateId) { this.stateId = stateId; }
    public String getEngine() { return engine; }
    public void setEngine(String engine) { this.engine = engine; }
    public String getPromptVersion() { return promptVersion; }
    public void setPromptVersion(String promptVersion) { this.promptVersion = promptVersion; }
    public String getResumeFingerprint() { return resumeFingerprint; }
    public void setResumeFingerprint(String resumeFingerprint) { this.resumeFingerprint = resumeFingerprint; }
    public String getTemplateFingerprint() { return templateFingerprint; }
    public void setTemplateFingerprint(String templateFingerprint) { this.templateFingerprint = templateFingerprint; }
    public int getRecommendationScore() { return recommendationScore; }
    public void setRecommendationScore(int recommendationScore) { this.recommendationScore = recommendationScore; }
    public int getFitScore() { return fitScore; }
    public void setFitScore(int fitScore) { this.fitScore = fitScore; }
    public int getEvidenceScore() { return evidenceScore; }
    public void setEvidenceScore(int evidenceScore) { this.evidenceScore = evidenceScore; }
    public int getGithubMatchScore() { return githubMatchScore; }
    public void setGithubMatchScore(int githubMatchScore) { this.githubMatchScore = githubMatchScore; }
    public int getReviewerScore() { return reviewerScore; }
    public void setReviewerScore(int reviewerScore) { this.reviewerScore = reviewerScore; }
    public int getSupported() { return supported; }
    public void setSupported(int supported) { this.supported = supported; }
    public int getStretched() { return stretched; }
    public void setStretched(int stretched) { this.stretched = stretched; }
    public int getUnsupported() { return unsupported; }
    public void setUnsupported(int unsupported) { this.unsupported = unsupported; }
    public int getPromptTokens() { return promptTokens; }
    public void setPromptTokens(int promptTokens) { this.promptTokens = promptTokens; }
    public int getCompletionTokens() { return completionTokens; }
    public void setCompletionTokens(int completionTokens) { this.completionTokens = completionTokens; }
    public BigDecimal getEstimatedCostUsd() { return estimatedCostUsd; }
    public void setEstimatedCostUsd(BigDecimal estimatedCostUsd) { this.estimatedCostUsd = estimatedCostUsd; }
    public String getClaimsJson() { return claimsJson; }
    public void setClaimsJson(String claimsJson) { this.claimsJson = claimsJson; }
    public Instant getCreatedAt() { return createdAt; }
}
