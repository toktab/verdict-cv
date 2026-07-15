package dev.toktab.brainhack.hiring;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.account.UserAccount;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class ProjectPermissionService {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private final ProjectInviteRepository inviteRepository;
    private final ProjectMemberPermissionRepository permissionRepository;
    private final ObjectMapper objectMapper;

    public ProjectPermissionService(ProjectInviteRepository inviteRepository,
                                    ProjectMemberPermissionRepository permissionRepository,
                                    ObjectMapper objectMapper) {
        this.inviteRepository = inviteRepository;
        this.permissionRepository = permissionRepository;
        this.objectMapper = objectMapper;
    }

    public String roleFor(UserAccount actor, HiringProject project) {
        if (project.getOwner().getId().equals(actor.getId())) return "Head Admin";
        return permissionRepository.findByProjectIdAndMemberEmailIgnoreCase(project.getId(), actor.getEmail())
                .map(ProjectMemberPermission::getRole)
                .map(this::displayRole)
                .orElseGet(() -> inviteRepository
                        .findFirstByProjectIdAndInvitedEmailIgnoreCaseAndStatusOrderByCreatedAtDesc(project.getId(), actor.getEmail(), "ACCEPTED")
                        .map(ProjectInvite::getRole)
                        .map(this::displayRole)
                        .orElse("Viewer"));
    }

    public List<String> permissionsFor(UserAccount actor, HiringProject project) {
        if (project.getOwner().getId().equals(actor.getId())) return permissionsForRole("Head Admin");
        return permissionRepository.findByProjectIdAndMemberEmailIgnoreCase(project.getId(), actor.getEmail())
                .map(row -> readPermissions(row.getPermissionsJson(), row.getRole()))
                .orElseGet(() -> permissionsForRole(roleFor(actor, project)));
    }

    public List<String> permissionsForRole(String role) {
        String normalized = displayRole(role).toLowerCase(Locale.ROOT);
        List<String> permissions = new ArrayList<>();
        permissions.add("canView");
        if (normalized.contains("voter")) {
            permissions.add("canVote");
        } else if (normalized.contains("reviewer")) {
            permissions.addAll(List.of("canVote", "canAddNote"));
        } else if (normalized.contains("screener")) {
            permissions.addAll(List.of("canVote", "canAddNote", "canMarkOnCheck"));
        } else if (normalized.contains("coordinator") || normalized.contains("admin")) {
            permissions.addAll(List.of(
                    "canVote", "canAddNote", "canMarkOnCheck", "canSetInterview", "canHire", "canClose",
                    "canInvite", "canTeamManage", "canKickMembers", "canPromoteMembers", "canDemoteMembers",
                    "canChangePermissions", "canMessage", "canViewActivityLog"
            ));
            if (normalized.contains("head")) permissions.add("protectedAccount");
        }
        return permissions.stream().distinct().toList();
    }

    public boolean has(UserAccount actor, HiringProject project, String permission) {
        return permissionsFor(actor, project).contains(permission);
    }

    public ProjectMemberPermission saveRole(HiringProject project, UserAccount member, String role, UserAccount updatedBy) {
        ProjectMemberPermission row = permissionRepository
                .findByProjectIdAndMemberEmailIgnoreCase(project.getId(), member.getEmail())
                .orElseGet(ProjectMemberPermission::new);
        String canonical = canonicalRole(role);
        row.setProject(project);
        row.setMemberEmail(member.getEmail().toLowerCase(Locale.ROOT));
        row.setRole(displayRole(canonical));
        row.setPermissionsJson(writePermissions(permissionsForRole(canonical)));
        row.setUpdatedBy(updatedBy);
        row.setUpdatedAt(Instant.now());
        return permissionRepository.save(row);
    }

    public boolean removeOverrides(Long projectId, String email) {
        return permissionRepository.findByProjectIdAndMemberEmailIgnoreCase(projectId, email)
                .map(row -> {
                    permissionRepository.delete(row);
                    return true;
                })
                .orElse(false);
    }

    public List<ProjectMemberPermission> overrides(Long projectId) {
        return permissionRepository.findByProjectId(projectId);
    }

    public String canonicalRole(String role) {
        String normalized = clean(role, "Reviewer").replace('_', ' ').replace('-', ' ').toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "viewer" -> "VIEWER";
            case "voter" -> "VOTER";
            case "reviewer" -> "REVIEWER";
            case "screener" -> "SCREENER";
            case "coordinator" -> "COORDINATOR";
            case "admin" -> "ADMIN";
            case "head admin", "organization admin" -> "ORGANIZATION_ADMIN";
            case "custom" -> "CUSTOM";
            default -> throw new IllegalArgumentException("Unsupported member role");
        };
    }

    public String displayRole(String role) {
        String normalized = clean(role, "Reviewer").replace('_', ' ').replace('-', ' ').toLowerCase(Locale.ROOT);
        if (normalized.contains("organization admin") || normalized.contains("head admin")) return "Head Admin";
        if (normalized.contains("coordinator")) return "Coordinator";
        if (normalized.equals("admin")) return "Admin";
        if (normalized.contains("screener")) return "Screener";
        if (normalized.contains("reviewer")) return "Reviewer";
        if (normalized.contains("voter")) return "Voter";
        if (normalized.contains("custom")) return "Custom";
        return "Viewer";
    }

    private List<String> readPermissions(String json, String fallbackRole) {
        try {
            List<String> permissions = objectMapper.readValue(json, STRING_LIST);
            return permissions == null || permissions.isEmpty() ? permissionsForRole(fallbackRole) : permissions.stream().distinct().toList();
        } catch (Exception ignored) {
            return permissionsForRole(fallbackRole);
        }
    }

    private String writePermissions(List<String> permissions) {
        try {
            return objectMapper.writeValueAsString(permissions);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Could not save project permissions");
        }
    }

    private String clean(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isEmpty() ? fallback : clean;
    }
}
