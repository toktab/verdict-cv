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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(
        name = "project_invites",
        indexes = {
                @Index(name = "idx_project_invites_project", columnList = "project_id"),
                @Index(name = "idx_project_invites_project_email_status", columnList = "project_id,invited_email,status"),
                @Index(name = "idx_project_invites_token", columnList = "token")
        }
)
public class ProjectInvite {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private HiringProject project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invited_by_id", nullable = false)
    private UserAccount invitedBy;

    @Column(nullable = false, length = 160)
    private String invitedEmail;

    @Column(nullable = false, length = 80)
    private String role;

    @Column(nullable = false, unique = true, length = 96)
    private String token;

    @Column(nullable = false, length = 40)
    private String status = "PENDING";

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant acceptedAt;

    public Long getId() { return id; }
    public HiringProject getProject() { return project; }
    public void setProject(HiringProject project) { this.project = project; }
    public UserAccount getInvitedBy() { return invitedBy; }
    public void setInvitedBy(UserAccount invitedBy) { this.invitedBy = invitedBy; }
    public String getInvitedEmail() { return invitedEmail; }
    public void setInvitedEmail(String invitedEmail) { this.invitedEmail = invitedEmail; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(Instant acceptedAt) { this.acceptedAt = acceptedAt; }
}
