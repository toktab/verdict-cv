package dev.toktab.brainhack.hiring;

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
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "hiring_projects",
        indexes = {
                @Index(name = "idx_hiring_projects_owner", columnList = "owner_id"),
                @Index(name = "idx_hiring_projects_created_at", columnList = "created_at")
        }
)
public class HiringProject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private UserAccount owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(nullable = false, length = 120)
    private String department;

    @Column(nullable = false, length = 120)
    private String location;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String description;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String requirementsText;

    @Column(nullable = false, length = 80)
    private String state;

    @Column(nullable = false, length = 80)
    private String status;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant deletedAt;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<HiringCandidate> candidates = new ArrayList<>();

    public Long getId() { return id; }
    public UserAccount getOwner() { return owner; }
    public void setOwner(UserAccount owner) { this.owner = owner; }
    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getRequirementsText() { return requirementsText; }
    public void setRequirementsText(String requirementsText) { this.requirementsText = requirementsText; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public List<HiringCandidate> getCandidates() { return candidates; }
}
