package dev.toktab.brainhack.hiring;

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
import java.time.Instant;

@Entity
@Table(
        name = "candidate_claims",
        indexes = {
                @Index(name = "idx_candidate_claims_candidate", columnList = "candidate_id"),
                @Index(name = "idx_candidate_claims_status", columnList = "candidate_id,status")
        }
)
public class CandidateClaim {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private HiringCandidate candidate;

    @Lob
    @Column(name = "claim_text", nullable = false, columnDefinition = "TEXT")
    private String claimText;

    @Column(nullable = false, length = 40)
    private String status = "Unsupported";

    @Lob
    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "sentence_index", nullable = false)
    private int sentenceIndex;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_run_id")
    private CandidateAnalysisRun analysisRun;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public HiringCandidate getCandidate() { return candidate; }
    public void setCandidate(HiringCandidate candidate) { this.candidate = candidate; }
    public String getClaimText() { return claimText; }
    public void setClaimText(String claimText) { this.claimText = claimText; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public int getSentenceIndex() { return sentenceIndex; }
    public void setSentenceIndex(int sentenceIndex) { this.sentenceIndex = sentenceIndex; }
    public CandidateAnalysisRun getAnalysisRun() { return analysisRun; }
    public void setAnalysisRun(CandidateAnalysisRun analysisRun) { this.analysisRun = analysisRun; }
    public Instant getCreatedAt() { return createdAt; }
}
