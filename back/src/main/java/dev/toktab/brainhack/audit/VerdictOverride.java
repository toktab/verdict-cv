package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.account.UserAccount;
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
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(
        name = "verdict_overrides",
        indexes = {
                @Index(name = "idx_verdict_overrides_verdict", columnList = "verdict_id,created_at")
        }
)
public class VerdictOverride {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "verdict_id", nullable = false)
    private Verdict verdict;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private UserAccount author;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private VerdictStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private VerdictStatus newStatus;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String reason;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public Verdict getVerdict() { return verdict; }
    public void setVerdict(Verdict verdict) { this.verdict = verdict; }
    public UserAccount getAuthor() { return author; }
    public void setAuthor(UserAccount author) { this.author = author; }
    public VerdictStatus getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(VerdictStatus previousStatus) { this.previousStatus = previousStatus; }
    public VerdictStatus getNewStatus() { return newStatus; }
    public void setNewStatus(VerdictStatus newStatus) { this.newStatus = newStatus; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Instant getCreatedAt() { return createdAt; }
}
