package dev.toktab.brainhack.messaging;

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
        name = "app_messages",
        indexes = {
                @Index(name = "idx_app_messages_recipient", columnList = "recipient_email"),
                @Index(name = "idx_app_messages_recipient_read", columnList = "recipient_email,read_at"),
                @Index(name = "idx_app_messages_sender", columnList = "sender_id"),
                @Index(name = "idx_app_messages_created_at", columnList = "created_at")
        }
)
public class AppMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private UserAccount sender;

    @Column(nullable = false, length = 160)
    private String senderEmail;

    @Column(nullable = false, length = 160)
    private String senderName;

    @Column(nullable = false, length = 160)
    private String recipientEmail;

    @Column(nullable = false, length = 220)
    private String subject;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false, length = 40)
    private String type = "MESSAGE";

    @Column(length = 96)
    private String inviteToken;

    @Column(length = 40)
    private String inviteStatus;

    private Long projectId;

    @Column(length = 220)
    private String projectTitle;

    @Column(name = "read_flag", nullable = false)
    private boolean read;

    @Column(nullable = false)
    private boolean starred;

    private Instant readAt;

    @Column(nullable = false)
    private boolean archived;

    @Column(nullable = false)
    private boolean manualUnread;

    @Column(columnDefinition = "LONGTEXT")
    private String candidateAttachmentsJson = "[]";

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Long replyToMessageId;

    private Long forwardedFromMessageId;

    public Long getId() { return id; }
    public UserAccount getSender() { return sender; }
    public void setSender(UserAccount sender) { this.sender = sender; }
    public String getSenderEmail() { return senderEmail; }
    public void setSenderEmail(String senderEmail) { this.senderEmail = senderEmail; }
    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }
    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getInviteToken() { return inviteToken; }
    public void setInviteToken(String inviteToken) { this.inviteToken = inviteToken; }
    public String getInviteStatus() { return inviteStatus; }
    public void setInviteStatus(String inviteStatus) { this.inviteStatus = inviteStatus; }
    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }
    public String getProjectTitle() { return projectTitle; }
    public void setProjectTitle(String projectTitle) { this.projectTitle = projectTitle; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public boolean isStarred() { return starred; }
    public void setStarred(boolean starred) { this.starred = starred; }
    public Instant getReadAt() { return readAt; }
    public void setReadAt(Instant readAt) { this.readAt = readAt; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public boolean isManualUnread() { return manualUnread; }
    public void setManualUnread(boolean manualUnread) { this.manualUnread = manualUnread; }
    public String getCandidateAttachmentsJson() { return candidateAttachmentsJson; }
    public void setCandidateAttachmentsJson(String candidateAttachmentsJson) { this.candidateAttachmentsJson = candidateAttachmentsJson; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Long getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(Long replyToMessageId) { this.replyToMessageId = replyToMessageId; }
    public Long getForwardedFromMessageId() { return forwardedFromMessageId; }
    public void setForwardedFromMessageId(Long forwardedFromMessageId) { this.forwardedFromMessageId = forwardedFromMessageId; }
}
