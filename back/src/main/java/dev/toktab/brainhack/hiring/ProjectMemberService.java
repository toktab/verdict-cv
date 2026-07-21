package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.hiring.HiringDtos.MemberRoleRequest;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectMemberResponse;
import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class ProjectMemberService {
    private final HiringProjectRepository projectRepository;
    private final OrganizationRepository organizationRepository;
    private final TeamMembershipRepository membershipRepository;
    private final ProjectInviteRepository inviteRepository;
    private final UserAccountService userAccountService;
    private final HiringProjectService projectService;
    private final CandidateAnalysisService candidateAnalysisService;
    private final ProjectPermissionService permissionService;
    private final HiringMapper mapper;

    public ProjectMemberService(
            HiringProjectRepository projectRepository,
            OrganizationRepository organizationRepository,
            TeamMembershipRepository membershipRepository,
            ProjectInviteRepository inviteRepository,
            UserAccountService userAccountService,
            HiringProjectService projectService,
            CandidateAnalysisService candidateAnalysisService,
            ProjectPermissionService permissionService,
            HiringMapper mapper) {
        this.projectRepository = projectRepository;
        this.organizationRepository = organizationRepository;
        this.membershipRepository = membershipRepository;
        this.inviteRepository = inviteRepository;
        this.userAccountService = userAccountService;
        this.projectService = projectService;
        this.candidateAnalysisService = candidateAnalysisService;
        this.permissionService = permissionService;
        this.mapper = mapper;
    }

    @Transactional
    public List<ProjectMemberResponse> members(UserAccount actor, Long projectId) {
        HiringProject project = projectService.entity(actor, projectId);
        List<ProjectMemberResponse> rows = new ArrayList<>();
        UserAccount owner = project.getOwner();
        rows.add(new ProjectMemberResponse(
                owner.getId(), displayName(owner), owner.getEmail(),
                "Head Admin", rolePermissions("Head Admin"), "ACTIVE", "OWNER", true));
        Set<String> knownEmails = new HashSet<>();
        rows.forEach(row -> knownEmails.add(row.email().toLowerCase(Locale.ROOT)));
        for (ProjectInvite invite : inviteRepository.findByProjectIdOrderByCreatedAtDesc(projectId)) {
            String email = invite.getInvitedEmail().toLowerCase(Locale.ROOT);
            if (knownEmails.contains(email)) continue;
            UserAccount member = userAccountService.findActiveByUsernameOrEmail(email).orElse(null);
            boolean active = "ACCEPTED".equals(invite.getStatus()) && member != null;
            String role = active ? actorRole(member, project) : displayRole(invite.getRole());
            List<String> perms = active ? permissionsFor(member, project) : rolePermissions(role);
            rows.add(new ProjectMemberResponse(
                    member == null ? invite.getId() : member.getId(),
                    member == null ? invite.getInvitedEmail().split("@")[0] : displayName(member),
                    invite.getInvitedEmail(), role, perms,
                    active ? "ACTIVE" : invite.getStatus(),
                    active ? "MEMBERSHIP" : "INVITE",
                    perms.contains("protectedAccount")));
            knownEmails.add(email);
        }
        for (ProjectMemberPermission override : permissionService.overrides(projectId)) {
            String email = override.getMemberEmail().toLowerCase(Locale.ROOT);
            if (knownEmails.contains(email)) continue;
            UserAccount member = userAccountService.findActiveByUsernameOrEmail(email).orElse(null);
            if (member == null) continue;
            List<String> perms = permissionsFor(member, project);
            rows.add(new ProjectMemberResponse(
                    member.getId(), displayName(member), member.getEmail(),
                    actorRole(member, project), perms,
                    "ACTIVE", "MEMBERSHIP", perms.contains("protectedAccount")));
            knownEmails.add(email);
        }
        return rows;
    }

    @Transactional
    public List<ProjectMemberResponse> updateRole(UserAccount actor, Long projectId, MemberRoleRequest request) {
        HiringProject project = projectService.entity(actor, projectId);
        String role = canonicalRole(request.role());
        String targetEmail = defaulted(request.email(), "").trim().toLowerCase(Locale.ROOT);
        UserAccount target = userAccountService.findActiveByUsernameOrEmail(targetEmail)
                .orElseThrow(() -> new IllegalArgumentException("Member user not found"));
        if (project.getOrganization() == null) {
            throw new IllegalArgumentException("Project organization not found");
        }
        TeamMembership targetMembership = membershipRepository
                .findByOrganizationIdAndUserId(project.getOrganization().getId(), target.getId())
                .orElseGet(() -> {
                    TeamMembership m = new TeamMembership();
                    m.setOrganization(project.getOrganization());
                    m.setUser(target);
                    return m;
                });
        if ("ORGANIZATION_ADMIN".equals(role)) {
            UserAccount previousOwner = project.getOwner();
            project.setOwner(target);
            if (!previousOwner.getId().equals(target.getId())) {
                TeamMembership previousMembership = membershipRepository
                        .findByOrganizationIdAndUserId(project.getOrganization().getId(), previousOwner.getId())
                        .orElseGet(() -> {
                            TeamMembership m = new TeamMembership();
                            m.setOrganization(project.getOrganization());
                            m.setUser(previousOwner);
                            return m;
                        });
                previousMembership.setRole("ADMIN");
                membershipRepository.save(previousMembership);
                permissionService.saveRole(project, previousOwner, "ADMIN", actor);
            }
        }
        targetMembership.setRole(role);
        membershipRepository.save(targetMembership);
        permissionService.saveRole(project, target, role, actor);
        inviteRepository
                .findFirstByProjectIdAndInvitedEmailIgnoreCaseAndStatusOrderByCreatedAtDesc(
                        projectId, target.getEmail(), "ACCEPTED")
                .ifPresent(invite -> {
                    invite.setRole(role);
                    inviteRepository.save(invite);
                });
        projectRepository.save(project);
        projectService.recordActivity(project, actor, "rank_change", "Changed member role", "warn",
                request.email() + " is now " + displayRole(role) + ".");
        return members(actor, projectId);
    }

    @Transactional
    public List<ProjectMemberResponse> removeMember(UserAccount actor, Long projectId, String email) {
        HiringProject project = projectService.entity(actor, projectId);
        String targetEmail = defaulted(email, "").trim().toLowerCase(Locale.ROOT);
        if (targetEmail.isBlank()) throw new IllegalArgumentException("Member email required");
        if (project.getOwner().getEmail().equalsIgnoreCase(targetEmail)) {
            throw new IllegalArgumentException("Protected owner cannot be kicked");
        }
        boolean removed = false;
        for (ProjectInvite invite : inviteRepository.findByProjectIdOrderByCreatedAtDesc(projectId)) {
            if (invite.getInvitedEmail().equalsIgnoreCase(targetEmail)
                    && Set.of("PENDING", "ACCEPTED").contains(invite.getStatus())) {
                invite.setStatus("REVOKED");
                inviteRepository.save(invite);
                removed = true;
            }
        }
        removed = permissionService.removeOverrides(projectId, targetEmail) || removed;
        if (!removed) throw new IllegalArgumentException("Project member not found");
        projectService.recordActivity(project, actor, "kick", "Kicked " + targetEmail + " from project",
                "danger", targetEmail + " was removed from " + project.getTitle() + ".");
        return members(actor, projectId);
    }

    private String displayName(UserAccount account) {
        String name = defaulted(account.getFullName(), account.getUsername());
        return name.contains("@") ? account.getUsername() : name;
    }

    private String actorRole(UserAccount member, HiringProject project) {
        if (project.getOwner().getId().equals(member.getId())) return "HEAD_ADMIN";
        if (project.getOrganization() == null) return "REVIEWER";
        return membershipRepository
                .findByOrganizationIdAndUserId(project.getOrganization().getId(), member.getId())
                .map(TeamMembership::getRole)
                .orElse("REVIEWER");
    }

    private List<String> permissionsFor(UserAccount member, HiringProject project) {
        return rolePermissions(actorRole(member, project));
    }

    private List<String> rolePermissions(String role) {
        return switch (defaulted(role, "").toUpperCase(Locale.ROOT)) {
            case "HEAD_ADMIN", "ORGANIZATION_ADMIN" -> List.of("all", "protectedAccount");
            case "ADMIN" -> List.of("canInvite", "canKickMembers", "canChangePermissions", "canAddNote", "canVote");
            case "COORDINATOR" -> List.of("canInvite", "canAddNote", "canVote", "canReview");
            case "REVIEWER" -> List.of("canAddNote", "canVote", "canReview");
            default -> List.of("canAddNote", "canVote");
        };
    }

    private String canonicalRole(String role) {
        String upper = defaulted(role, "").toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "HEAD_ADMIN", "ORGANIZATION_ADMIN" -> "ORGANIZATION_ADMIN";
            case "ADMIN" -> "ADMIN";
            case "COORDINATOR" -> "COORDINATOR";
            case "SCREENER" -> "SCREENER";
            default -> "REVIEWER";
        };
    }

    private String displayRole(String role) {
        String upper = defaulted(role, "").toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "ORGANIZATION_ADMIN" -> "Organization Admin";
            case "ADMIN" -> "Admin";
            case "COORDINATOR" -> "Coordinator";
            case "REVIEWER" -> "Reviewer";
            case "SCREENER" -> "Screener";
            default -> upper.isEmpty() ? "Reviewer" : upper;
        };
    }

    private String defaulted(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
