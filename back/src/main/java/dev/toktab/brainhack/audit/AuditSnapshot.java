package dev.toktab.brainhack.audit;

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
import java.time.Instant;

@Entity
@Table(
        name = "audit_snapshots",
        indexes = {
                @Index(name = "idx_audit_snapshots_audit", columnList = "audit_id,created_at")
        }
)
public class AuditSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "audit_id", nullable = false)
    private Audit audit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private UserAccount owner;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(nullable = false, length = 64)
    private String snapshotFingerprint;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public Audit getAudit() { return audit; }
    public void setAudit(Audit audit) { this.audit = audit; }
    public UserAccount getOwner() { return owner; }
    public void setOwner(UserAccount owner) { this.owner = owner; }
    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }
    public String getSnapshotFingerprint() { return snapshotFingerprint; }
    public void setSnapshotFingerprint(String snapshotFingerprint) { this.snapshotFingerprint = snapshotFingerprint; }
    public Instant getCreatedAt() { return createdAt; }
}
