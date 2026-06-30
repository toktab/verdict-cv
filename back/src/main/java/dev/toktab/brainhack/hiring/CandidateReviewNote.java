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
        name = "candidate_review_notes",
        indexes = {
                @Index(name = "idx_candidate_review_notes_candidate", columnList = "candidate_id,created_at")
        }
)
public class CandidateReviewNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private HiringCandidate candidate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private UserAccount author;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 80)
    private String decision;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String body;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public HiringCandidate getCandidate() { return candidate; }
    public void setCandidate(HiringCandidate candidate) { this.candidate = candidate; }
    public UserAccount getAuthor() { return author; }
    public void setAuthor(UserAccount author) { this.author = author; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Instant getCreatedAt() { return createdAt; }
}
