package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.hiring.HiringDtos.InviteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.InviteResponse;
import dev.toktab.brainhack.messaging.MessageService;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class ProjectInviteService {
    private final HiringProjectRepository projectRepository;
    private final ProjectInviteRepository inviteRepository;
    private final HiringMapper mapper;
    private final MessageService messageService;
    private final UserAccountService userAccountService;
    private final HiringProjectService projectService;
    private final CandidateAnalysisService candidateAnalysisService;
    private final ProjectPermissionService permissionService;
    private final SecureRandom secureRandom = new SecureRandom();

    public ProjectInviteService(
            HiringProjectRepository projectRepository,
            ProjectInviteRepository inviteRepository,
            HiringMapper mapper,
            MessageService messageService,
            UserAccountService userAccountService,
            HiringProjectService projectService,
            CandidateAnalysisService candidateAnalysisService,
            ProjectPermissionService permissionService) {
        this.projectRepository = projectRepository;
        this.inviteRepository = inviteRepository;
        this.mapper = mapper;
        this.messageService = messageService;
        this.userAccountService = userAccountService;
        this.projectService = projectService;
        this.candidateAnalysisService = candidateAnalysisService;
        this.permissionService = permissionService;
    }

    @Transactional
    public InviteResponse invite(UserAccount actor, Long projectId, InviteRequest request) {
        HiringProject project = projectService.entity(actor, projectId);
        ProjectInvite invite = new ProjectInvite();
        String rawInvitee = defaulted(request.email(), "").toLowerCase(Locale.ROOT);
        UserAccount invitedUser = userAccountService.findActiveByUsernameOrEmail(rawInvitee).orElse(null);
        if (invitedUser == null && !rawInvitee.contains("@")) {
            throw new IllegalArgumentException("Invite user not found");
        }
        invite.setProject(project);
        invite.setInvitedBy(actor);
        invite.setInvitedEmail(invitedUser != null ? invitedUser.getEmail() : rawInvitee);
        String defaultRole = "REVIEWER";
        invite.setRole(defaulted(request.role(), defaultRole).toUpperCase(Locale.ROOT));
        invite.setToken(randomToken());
        ProjectInvite saved = inviteRepository.save(invite);
        messageService.createInviteMessage(actor, saved.getInvitedEmail(), project.getTitle(),
                project.getId(), saved.getToken());
        projectService.recordActivity(project, actor, "invite_create", "Invited " + saved.getInvitedEmail(),
                "good", "Role: " + saved.getRole());
        return mapper.invite(saved);
    }

    @Transactional
    public InviteResponse acceptInvite(UserAccount actor, String token) {
        ProjectInvite invite = inviteRepository.findByTokenAndStatus(token, "PENDING")
                .orElseThrow(() -> new IllegalArgumentException("Invite not found"));
        if (!actor.getEmail().equalsIgnoreCase(invite.getInvitedEmail())) {
            throw new IllegalArgumentException("Invite belongs to a different account");
        }
        Organization organization = invite.getProject().getOrganization();
        if (organization == null) {
            organization = projectService.ensureOrganization(invite.getProject().getOwner());
            invite.getProject().setOrganization(organization);
        }
        invite.setStatus("ACCEPTED");
        invite.setAcceptedAt(Instant.now());
        ProjectInvite saved = inviteRepository.save(invite);
        messageService.markInviteAccepted(saved.getToken(), actor);
        projectService.recordActivity(saved.getProject(), actor, "invite_accept", "Accepted invite",
                "good", actor.getEmail() + " joined the project.");
        return mapper.invite(saved);
    }

    @Transactional(readOnly = true)
    public List<InviteResponse> invites(UserAccount actor, Long projectId) {
        return inviteRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(mapper::invite)
                .toList();
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String defaulted(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
