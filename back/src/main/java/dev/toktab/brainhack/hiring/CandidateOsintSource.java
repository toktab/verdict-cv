package dev.toktab.brainhack.hiring;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(
        name = "candidate_osint_sources",
        indexes = {
                @Index(name = "idx_candidate_osint_sources_candidate", columnList = "candidate_id"),
                @Index(name = "idx_candidate_osint_sources_type", columnList = "candidate_id,source_type")
        }
)
public class CandidateOsintSource {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private HiringCandidate candidate;

    @Column(name = "source_type", nullable = false, length = 40)
    private String sourceType;

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(length = 255)
    private String finding;

    @Column(nullable = false)
    private int confidence;

    @Column(length = 80)
    private String impact;

    @Column(length = 40)
    private String tone;

    @Column(name = "checked_at")
    private Instant checkedAt;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public HiringCandidate getCandidate() { return candidate; }
    public void setCandidate(HiringCandidate candidate) { this.candidate = candidate; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public String getFinding() { return finding; }
    public void setFinding(String finding) { this.finding = finding; }
    public int getConfidence() { return confidence; }
    public void setConfidence(int confidence) { this.confidence = confidence; }
    public String getImpact() { return impact; }
    public void setImpact(String impact) { this.impact = impact; }
    public String getTone() { return tone; }
    public void setTone(String tone) { this.tone = tone; }
    public Instant getCheckedAt() { return checkedAt; }
    public void setCheckedAt(Instant checkedAt) { this.checkedAt = checkedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
