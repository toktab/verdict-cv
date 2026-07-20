package dev.toktab.brainhack.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "verdict_revisions")
public class VerdictRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "verdict_id", nullable = false)
    private Verdict verdict;

    @Column(nullable = false, length = 32)
    private String actorType;

    @Column(nullable = false, length = 160)
    private String actorName;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String patchJson;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String reason;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Verdict getVerdict() { return verdict; }
    public void setVerdict(Verdict verdict) { this.verdict = verdict; }
    public String getActorType() { return actorType; }
    public void setActorType(String actorType) { this.actorType = actorType; }
    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }
    public String getPatchJson() { return patchJson; }
    public void setPatchJson(String patchJson) { this.patchJson = patchJson; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Instant getCreatedAt() { return createdAt; }
}

