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
        return ProjectPermission.defaultPermissionsForRole(ProjectRole.from(role));
    }

    public boolean has(UserAccount actor, HiringProject project, String permission) {
        return permissionsFor(actor, project).contains(permission);
    }

    public void requirePermission(UserAccount actor, HiringProject project, String permission) {
        if (!has(actor, project, permission)) {
            throw new IllegalArgumentException("Project permission required: " + permission);
        }
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
        return ProjectRole.from(role).name();
    }

    public String displayRole(String role) {
        return ProjectRole.from(role).displayName();
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
