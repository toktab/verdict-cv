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
import java.time.Instant;

@Entity
@Table(name = "project_announcements", indexes = {
        @Index(name = "idx_project_announcement_project_created", columnList = "project_id,created_at"),
        @Index(name = "idx_project_announcement_project_pinned", columnList = "project_id,pinned")
})
public class ProjectAnnouncement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private HiringProject project;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private UserAccount author;
    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String body;
    @Lob
    @Column(nullable = false, columnDefinition = "TEXT")
    private String mentionsJson = "[]";
    @Column(nullable = false)
    private boolean pinned;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    private Instant updatedAt;
    private Instant deletedAt;

    public Long getId() { return id; }
    public HiringProject getProject() { return project; }
    public void setProject(HiringProject project) { this.project = project; }
    public UserAccount getAuthor() { return author; }
    public void setAuthor(UserAccount author) { this.author = author; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getMentionsJson() { return mentionsJson; }
    public void setMentionsJson(String mentionsJson) { this.mentionsJson = mentionsJson; }
    public boolean isPinned() { return pinned; }
    public void setPinned(boolean pinned) { this.pinned = pinned; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
