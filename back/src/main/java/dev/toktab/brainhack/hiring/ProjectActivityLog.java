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
@Table(
        name = "project_activity_logs",
        indexes = {
                @Index(name = "idx_project_activity_project_created", columnList = "project_id,created_at"),
                @Index(name = "idx_project_activity_project_candidate", columnList = "project_id,candidate_id"),
                @Index(name = "idx_project_activity_project_actor", columnList = "project_id,actor_id")
        }
)
public class ProjectActivityLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private HiringProject project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private UserAccount actor;

    @Column(nullable = false, length = 80)
    private String type;
    @Column(nullable = false, length = 220)
    private String action;
    @Column(nullable = false, length = 160)
    private String actorEmail = "";
    @Column(nullable = false, length = 160)
    private String actorName = "";
    @Column(nullable = false, length = 160)
    private String targetEmail = "";
    @Column(nullable = false, length = 160)
    private String targetName = "";
    private Long candidateId;
    @Column(nullable = false, length = 160)
    private String candidateName = "";
    @Column(nullable = false, length = 180)
    private String projectTitle = "";
    @Column(nullable = false, length = 40)
    private String severity = "info";
    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String detail = "";
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public HiringProject getProject() { return project; }
    public void setProject(HiringProject project) { this.project = project; }
    public UserAccount getActor() { return actor; }
    public void setActor(UserAccount actor) { this.actor = actor; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getActorEmail() { return actorEmail; }
    public void setActorEmail(String actorEmail) { this.actorEmail = actorEmail; }
    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }
    public String getTargetEmail() { return targetEmail; }
    public void setTargetEmail(String targetEmail) { this.targetEmail = targetEmail; }
    public String getTargetName() { return targetName; }
    public void setTargetName(String targetName) { this.targetName = targetName; }
    public Long getCandidateId() { return candidateId; }
    public void setCandidateId(Long candidateId) { this.candidateId = candidateId; }
    public String getCandidateName() { return candidateName; }
    public void setCandidateName(String candidateName) { this.candidateName = candidateName; }
    public String getProjectTitle() { return projectTitle; }
    public void setProjectTitle(String projectTitle) { this.projectTitle = projectTitle; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
