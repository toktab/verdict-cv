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
        name = "hiring_candidates",
        indexes = {
                @Index(name = "idx_hiring_candidates_project", columnList = "project_id"),
                @Index(name = "idx_hiring_candidates_email", columnList = "candidate_email"),
                @Index(name = "idx_hiring_candidates_project_state", columnList = "project_id,state"),
                @Index(name = "idx_hiring_candidates_created_at", columnList = "created_at")
        }
)
public class HiringCandidate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private HiringProject project;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(name = "candidate_email", length = 160)
    private String candidateEmail;

    @Column(nullable = false, length = 160)
    private String role;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String cvText;

    @Column(nullable = false, length = 220)
    private String resumeFilename;

    @Column(nullable = false)
    private int score;

    @Column(nullable = false)
    private int matchScore;

    @Column(nullable = false, length = 40)
    private String risk;

    @Column(nullable = false, length = 80)
    private String state;

    @Column(nullable = false, length = 80)
    private String osint;

    @Column(nullable = false, length = 120)
    private String memory;

    @Column(nullable = false, length = 40)
    private String analysisState = "strict-war-ai";

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String initializedAnalysisStatesJson = "[\"strict-war-ai\"]";

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String memoryHistoryJson = "[]";

    @Column(nullable = false)
    private int flags;

    @Column(nullable = false)
    private int supported;

    @Column(nullable = false)
    private int stretched;

    @Column(nullable = false)
    private int unsupported;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String summary;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String claimsJson;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String auditPhraseMatchesJson;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant deletedAt;

    public Long getId() { return id; }
    public HiringProject getProject() { return project; }
    public void setProject(HiringProject project) { this.project = project; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCandidateEmail() { return candidateEmail; }
    public void setCandidateEmail(String candidateEmail) { this.candidateEmail = candidateEmail; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getCvText() { return cvText; }
    public void setCvText(String cvText) { this.cvText = cvText; }
    public String getResumeFilename() { return resumeFilename; }
    public void setResumeFilename(String resumeFilename) { this.resumeFilename = resumeFilename; }
    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }
    public int getMatchScore() { return matchScore; }
    public void setMatchScore(int matchScore) { this.matchScore = matchScore; }
    public String getRisk() { return risk; }
    public void setRisk(String risk) { this.risk = risk; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getOsint() { return osint; }
    public void setOsint(String osint) { this.osint = osint; }
    public String getMemory() { return memory; }
    public void setMemory(String memory) { this.memory = memory; }
    public String getAnalysisState() { return analysisState; }
    public void setAnalysisState(String analysisState) { this.analysisState = analysisState; }
    public String getInitializedAnalysisStatesJson() { return initializedAnalysisStatesJson; }
    public void setInitializedAnalysisStatesJson(String initializedAnalysisStatesJson) { this.initializedAnalysisStatesJson = initializedAnalysisStatesJson; }
    public String getMemoryHistoryJson() { return memoryHistoryJson; }
    public void setMemoryHistoryJson(String memoryHistoryJson) { this.memoryHistoryJson = memoryHistoryJson; }
    public int getFlags() { return flags; }
    public void setFlags(int flags) { this.flags = flags; }
    public int getSupported() { return supported; }
    public void setSupported(int supported) { this.supported = supported; }
    public int getStretched() { return stretched; }
    public void setStretched(int stretched) { this.stretched = stretched; }
    public int getUnsupported() { return unsupported; }
    public void setUnsupported(int unsupported) { this.unsupported = unsupported; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getClaimsJson() { return claimsJson; }
    public void setClaimsJson(String claimsJson) { this.claimsJson = claimsJson; }
    public String getAuditPhraseMatchesJson() { return auditPhraseMatchesJson; }
    public void setAuditPhraseMatchesJson(String auditPhraseMatchesJson) { this.auditPhraseMatchesJson = auditPhraseMatchesJson; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
