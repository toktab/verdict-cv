package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.account.UserAccount;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
