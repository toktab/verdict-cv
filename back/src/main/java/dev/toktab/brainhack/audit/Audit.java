package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.account.UserAccount;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "audits",
        indexes = {
                @Index(name = "idx_audits_created_at", columnList = "created_at"),
                @Index(name = "idx_audits_owner_created_at", columnList = "owner_id, created_at"),
                @Index(name = "idx_audits_owner_deleted_created", columnList = "owner_id, deleted_at, created_at")
        }
)
public class Audit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(nullable = false, length = 160)
    private String claimTitle;

    @Column(nullable = false, length = 160)
    private String evidenceTitle;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String claimText;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String evidenceText;

    @Column(nullable = false)
    private int credibilityScore;

    @Column(nullable = false)
    private int supportedCount;

    @Column(nullable = false)
    private int stretchedCount;

    @Column(nullable = false)
    private int unsupportedCount;

    @Column(nullable = false)
    private int notClaimCount;

    @Column(nullable = false)
    private int gapCount;

    @Column(nullable = false, length = 64)
    private String claimFingerprint;

    @Column(nullable = false, length = 64)
    private String evidenceFingerprint;

    @Column(nullable = false)
    private long processingMillis;

    @Column(nullable = false, length = 40)
    private String engine;

    @Column(nullable = false)
    private int promptTokens;

    @Column(nullable = false)
    private int completionTokens;

    @Column(nullable = false)
    private int totalTokens;

    @Column(nullable = false, precision = 12, scale = 6)
    private BigDecimal estimatedCostUsd = BigDecimal.ZERO;

    @Column(length = 80)
    private String analyzerVersion;

    @Column(length = 80)
    private String promptVersion;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AuditStatus status = AuditStatus.RUNNING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AuditFailureType failureType = AuditFailureType.NONE;

    @Column(length = 240)
    private String failureMessage;

    @Column(nullable = false, length = 40)
    private String progressStage = "queued";

    @Column(nullable = false)
    private int progressPercent;

    @Column(nullable = false, length = 160)
    private String progressMessage = "Queued for analysis.";

    @Column(nullable = false)
    private boolean cancellationRequested;

    @Column(nullable = false)
    private int jobAttempts;

    private Instant queuedAt;

    private Instant startedAt;

    private Instant finishedAt;

    private Instant lastWorkerHeartbeatAt;

    @Column(length = 80)
    private String templateId;

    @Column(length = 120)
    private String templateName;

    @Column(length = 500)
    private String templateDescription;

    @Column(columnDefinition = "TEXT")
    private String templateInstructions;

    @Column(columnDefinition = "TEXT")
    private String templateMarkUnimportant;

    @Column(length = 80)
    private String checkStateId;

    @Column(length = 120)
    private String checkStateName;

    @Column(length = 500)
    private String checkStateDescription;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private UserAccount owner;

    @OneToMany(mappedBy = "audit", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sentenceIndex ASC")
    private List<Verdict> verdicts = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public long getVersion() {
        return version;
    }

    public void setVersion(long version) {
        this.version = version;
    }

    public String getClaimTitle() {
        return claimTitle;
    }

    public void setClaimTitle(String claimTitle) {
        this.claimTitle = claimTitle;
    }

    public String getEvidenceTitle() {
        return evidenceTitle;
    }

    public void setEvidenceTitle(String evidenceTitle) {
        this.evidenceTitle = evidenceTitle;
    }

    public String getClaimText() {
        return claimText;
    }

    public void setClaimText(String claimText) {
        this.claimText = claimText;
    }

    public String getEvidenceText() {
        return evidenceText;
    }

    public void setEvidenceText(String evidenceText) {
        this.evidenceText = evidenceText;
    }

    public int getCredibilityScore() {
        return credibilityScore;
    }

    public void setCredibilityScore(int credibilityScore) {
        this.credibilityScore = credibilityScore;
    }

    public int getSupportedCount() {
        return supportedCount;
    }

    public void setSupportedCount(int supportedCount) {
        this.supportedCount = supportedCount;
    }

    public int getStretchedCount() {
        return stretchedCount;
    }

    public void setStretchedCount(int stretchedCount) {
        this.stretchedCount = stretchedCount;
    }

    public int getUnsupportedCount() {
        return unsupportedCount;
    }

    public void setUnsupportedCount(int unsupportedCount) {
        this.unsupportedCount = unsupportedCount;
    }

    public int getNotClaimCount() {
        return notClaimCount;
    }

    public void setNotClaimCount(int notClaimCount) {
        this.notClaimCount = notClaimCount;
    }

    public int getGapCount() {
        return gapCount;
    }

    public void setGapCount(int gapCount) {
        this.gapCount = gapCount;
    }

    public String getClaimFingerprint() {
        return claimFingerprint;
    }

    public void setClaimFingerprint(String claimFingerprint) {
        this.claimFingerprint = claimFingerprint;
    }

    public String getEvidenceFingerprint() {
        return evidenceFingerprint;
    }

    public void setEvidenceFingerprint(String evidenceFingerprint) {
        this.evidenceFingerprint = evidenceFingerprint;
    }

    public long getProcessingMillis() {
        return processingMillis;
    }

    public void setProcessingMillis(long processingMillis) {
        this.processingMillis = processingMillis;
    }

    public String getEngine() {
        return engine;
    }

    public void setEngine(String engine) {
        this.engine = engine;
    }

    public int getPromptTokens() {
        return promptTokens;
    }

    public void setPromptTokens(int promptTokens) {
        this.promptTokens = promptTokens;
    }

    public int getCompletionTokens() {
        return completionTokens;
    }

    public void setCompletionTokens(int completionTokens) {
        this.completionTokens = completionTokens;
    }

    public int getTotalTokens() {
        return totalTokens;
    }

    public void setTotalTokens(int totalTokens) {
        this.totalTokens = totalTokens;
    }

    public BigDecimal getEstimatedCostUsd() {
        return estimatedCostUsd == null ? BigDecimal.ZERO : estimatedCostUsd;
    }

    public void setEstimatedCostUsd(BigDecimal estimatedCostUsd) {
        this.estimatedCostUsd = estimatedCostUsd == null ? BigDecimal.ZERO : estimatedCostUsd;
    }

    public String getAnalyzerVersion() {
        return analyzerVersion;
    }

    public void setAnalyzerVersion(String analyzerVersion) {
        this.analyzerVersion = analyzerVersion;
    }

    public String getPromptVersion() {
        return promptVersion;
    }

    public void setPromptVersion(String promptVersion) {
        this.promptVersion = promptVersion;
    }

    public AuditStatus getStatus() {
        return status == null ? AuditStatus.COMPLETED : status;
    }

    public void setStatus(AuditStatus status) {
        this.status = status;
    }

    public AuditFailureType getFailureType() {
        return failureType == null ? AuditFailureType.NONE : failureType;
    }

    public void setFailureType(AuditFailureType failureType) {
        this.failureType = failureType == null ? AuditFailureType.NONE : failureType;
    }

    public String getFailureMessage() {
        return failureMessage;
    }

    public void setFailureMessage(String failureMessage) {
        this.failureMessage = failureMessage;
    }

    public String getProgressStage() {
        return progressStage == null ? "completed" : progressStage;
    }

    public void setProgressStage(String progressStage) {
        this.progressStage = progressStage == null || progressStage.isBlank() ? "queued" : progressStage;
    }

    public int getProgressPercent() {
        return progressPercent;
    }

    public void setProgressPercent(int progressPercent) {
        this.progressPercent = Math.min(Math.max(progressPercent, 0), 100);
    }

    public String getProgressMessage() {
        return progressMessage == null ? "" : progressMessage;
    }

    public void setProgressMessage(String progressMessage) {
        this.progressMessage = progressMessage == null || progressMessage.isBlank() ? "Queued for analysis." : progressMessage;
    }

    public boolean isCancellationRequested() {
        return cancellationRequested;
    }

    public void setCancellationRequested(boolean cancellationRequested) {
        this.cancellationRequested = cancellationRequested;
    }

    public int getJobAttempts() {
        return jobAttempts;
    }

    public void setJobAttempts(int jobAttempts) {
        this.jobAttempts = Math.max(jobAttempts, 0);
    }

    public Instant getQueuedAt() {
        return queuedAt;
    }

    public void setQueuedAt(Instant queuedAt) {
        this.queuedAt = queuedAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
    }

    public Instant getLastWorkerHeartbeatAt() {
        return lastWorkerHeartbeatAt;
    }

    public void setLastWorkerHeartbeatAt(Instant lastWorkerHeartbeatAt) {
        this.lastWorkerHeartbeatAt = lastWorkerHeartbeatAt;
    }

    public String getTemplateId() {
        return templateId;
    }

    public void setTemplateId(String templateId) {
        this.templateId = templateId;
    }

    public String getTemplateName() {
        return templateName;
    }

    public void setTemplateName(String templateName) {
        this.templateName = templateName;
    }

    public String getTemplateDescription() {
        return templateDescription;
    }

    public void setTemplateDescription(String templateDescription) {
        this.templateDescription = templateDescription;
    }

    public String getTemplateInstructions() {
        return templateInstructions;
    }

    public void setTemplateInstructions(String templateInstructions) {
        this.templateInstructions = templateInstructions;
    }

    public String getTemplateMarkUnimportant() {
        return templateMarkUnimportant;
    }

    public void setTemplateMarkUnimportant(String templateMarkUnimportant) {
        this.templateMarkUnimportant = templateMarkUnimportant;
    }

    public String getCheckStateId() {
        return checkStateId;
    }

    public void setCheckStateId(String checkStateId) {
        this.checkStateId = checkStateId;
    }

    public String getCheckStateName() {
        return checkStateName;
    }

    public void setCheckStateName(String checkStateName) {
        this.checkStateName = checkStateName;
    }

    public String getCheckStateDescription() {
        return checkStateDescription;
    }

    public void setCheckStateDescription(String checkStateDescription) {
        this.checkStateDescription = checkStateDescription;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public List<Verdict> getVerdicts() {
        return verdicts;
    }

    public void setVerdicts(List<Verdict> verdicts) {
        this.verdicts = verdicts;
    }

    public void addVerdict(Verdict verdict) {
        verdict.setAudit(this);
        verdicts.add(verdict);
    }

    public UserAccount getOwner() {
        return owner;
    }

    public void setOwner(UserAccount owner) {
        this.owner = owner;
    }
}
