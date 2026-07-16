package dev.toktab.brainhack.ats;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(
        name = "official_ats_template_versions",
        indexes = {
                @Index(name = "idx_official_ats_active", columnList = "active"),
                @Index(name = "idx_official_ats_created", columnList = "created_at")
        }
)
public class OfficialAtsTemplateVersion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private int versionNumber;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String catalogJson;

    @Column(nullable = false, length = 500)
    private String changeNote;

    @Column(nullable = false, length = 120)
    private String createdBy;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public int getVersionNumber() { return versionNumber; }
    public void setVersionNumber(int versionNumber) { this.versionNumber = versionNumber; }
    public String getCatalogJson() { return catalogJson; }
    public void setCatalogJson(String catalogJson) { this.catalogJson = catalogJson; }
    public String getChangeNote() { return changeNote; }
    public void setChangeNote(String changeNote) { this.changeNote = changeNote; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
