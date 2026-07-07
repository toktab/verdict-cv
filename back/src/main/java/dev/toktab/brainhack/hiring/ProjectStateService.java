package dev.toktab.brainhack.hiring;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectActivityRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectActivityResponse;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectAtsTemplateRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectAtsTemplateResponse;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectMemberPermissionsRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectSettingsRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectSettingsResponse;
import dev.toktab.brainhack.realtime.RealtimeService;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class ProjectStateService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {};

    private final HiringProjectRepository projectRepository;
    private final TeamMembershipRepository membershipRepository;
    private final ProjectSettingRepository settingRepository;
    private final ProjectActivityLogRepository activityRepository;
    private final ProjectAtsTemplateRepository atsTemplateRepository;
    private final ProjectMemberPermissionRepository memberPermissionRepository;
    private final ObjectMapper objectMapper;
    private final RealtimeService realtimeService;

    public ProjectStateService(
            HiringProjectRepository projectRepository,
            TeamMembershipRepository membershipRepository,
            ProjectSettingRepository settingRepository,
            ProjectActivityLogRepository activityRepository,
            ProjectAtsTemplateRepository atsTemplateRepository,
            ProjectMemberPermissionRepository memberPermissionRepository,
            ObjectMapper objectMapper,
            RealtimeService realtimeService) {
        this.projectRepository = projectRepository;
        this.membershipRepository = membershipRepository;
        this.settingRepository = settingRepository;
        this.activityRepository = activityRepository;
        this.atsTemplateRepository = atsTemplateRepository;
        this.memberPermissionRepository = memberPermissionRepository;
        this.objectMapper = objectMapper;
        this.realtimeService = realtimeService;
    }

    @Transactional
    public ProjectSettingsResponse settings(UserAccount actor, Long projectId) {
        HiringProject project = accessibleProject(actor, projectId);
        return settingRepository.findByProjectId(project.getId())
                .map(setting -> new ProjectSettingsResponse(readMap(setting.getSettingsJson()), setting.getUpdatedAt()))
                .orElseGet(() -> new ProjectSettingsResponse(defaultSettings(), Instant.EPOCH));
    }

    @Transactional
    public ProjectSettingsResponse saveSettings(UserAccount actor, Long projectId, ProjectSettingsRequest request) {
        HiringProject project = manageableProject(actor, projectId);
        ProjectSetting setting = settingRepository.findByProjectId(project.getId()).orElseGet(ProjectSetting::new);
        setting.setProject(project);
        setting.setSettingsJson(writeJson(merge(defaultSettings(), request.settings())));
        setting.setUpdatedBy(actor);
        setting.setUpdatedAt(Instant.now());
        ProjectSetting saved = settingRepository.save(setting);
        record(project, actor, new ProjectActivityRequest("settings", "Saved project settings", "", "", null, "", "info", "Project settings were updated."));
        publish(project);
        return new ProjectSettingsResponse(readMap(saved.getSettingsJson()), saved.getUpdatedAt());
    }

    @Transactional
    public List<ProjectActivityResponse> activity(UserAccount actor, Long projectId) {
        HiringProject project = accessibleProject(actor, projectId);
        return activityRepository.findTop500ByProjectIdOrderByCreatedAtDesc(project.getId()).stream()
                .map(this::activityResponse)
                .toList();
    }

    @Transactional
    public ProjectActivityResponse record(UserAccount actor, Long projectId, ProjectActivityRequest request) {
        HiringProject project = accessibleProject(actor, projectId);
        ProjectActivityLog saved = record(project, actor, request);
        publish(project);
        return activityResponse(saved);
    }

    @Transactional
    public List<ProjectAtsTemplateResponse> atsTemplates(UserAccount actor, Long projectId) {
        HiringProject project = accessibleProject(actor, projectId);
        return atsTemplateRepository.findByProjectIdAndDeletedAtIsNullOrderByUpdatedAtDesc(project.getId()).stream()
                .map(this::atsResponse)
                .toList();
    }

    @Transactional
    public List<ProjectAtsTemplateResponse> saveAtsTemplates(UserAccount actor, Long projectId, List<ProjectAtsTemplateRequest> requests) {
        HiringProject project = manageableProject(actor, projectId);
        atsTemplateRepository.findByProjectIdAndDeletedAtIsNullOrderByUpdatedAtDesc(project.getId())
                .forEach(template -> template.setDeletedAt(Instant.now()));
        for (ProjectAtsTemplateRequest request : requests) {
            ProjectAtsTemplate template = new ProjectAtsTemplate();
            template.setProject(project);
            template.setOwner(actor);
            template.setTemplateKey(clean(request.id(), "template"));
            template.setName(clean(request.name(), "ATS template"));
            template.setVisibility(clean(request.visibility(), "Private"));
            template.setVerifiedDefault(request.verified());
            template.setTemplateJson(writeJson(request.template() == null ? Map.of() : request.template()));
            template.setCreatedAt(Instant.now());
            template.setUpdatedAt(Instant.now());
            atsTemplateRepository.save(template);
        }
        record(project, actor, new ProjectActivityRequest("ats_templates", "Saved ATS templates", "", "", null, "", "info", "Project ATS template library was updated."));
        publish(project);
        return atsTemplates(actor, projectId);
    }

    @Transactional
    public Map<String, List<String>> memberPermissions(UserAccount actor, Long projectId) {
        HiringProject project = accessibleProject(actor, projectId);
        Map<String, List<String>> rows = new LinkedHashMap<>();
        memberPermissionRepository.findByProjectId(project.getId()).forEach(row -> rows.put(row.getMemberEmail(), readList(row.getPermissionsJson())));
        return rows;
    }

    @Transactional
    public Map<String, List<String>> saveMemberPermissions(UserAccount actor, Long projectId, ProjectMemberPermissionsRequest request) {
        HiringProject project = manageableProject(actor, projectId);
        String email = clean(request.email(), "").toLowerCase(Locale.ROOT);
        ProjectMemberPermission row = memberPermissionRepository.findByProjectIdAndMemberEmailIgnoreCase(project.getId(), email).orElseGet(ProjectMemberPermission::new);
        row.setProject(project);
        row.setMemberEmail(email);
        row.setRole(clean(request.role(), "Custom"));
        row.setPermissionsJson(writeJson(request.permissions() == null ? List.of() : request.permissions()));
        row.setUpdatedBy(actor);
        row.setUpdatedAt(Instant.now());
        memberPermissionRepository.save(row);
        record(project, actor, new ProjectActivityRequest("permissions", "Changed custom permissions", email, email, null, "", "warn", "Updated custom project permissions."));
        publish(project);
        return memberPermissions(actor, projectId);
    }

    public ProjectActivityLog record(HiringProject project, UserAccount actor, ProjectActivityRequest request) {
        ProjectActivityLog log = new ProjectActivityLog();
        log.setProject(project);
        log.setActor(actor);
        log.setType(clean(request.type(), "activity"));
        log.setAction(clean(request.action(), "Updated project"));
        log.setActorEmail(clean(actor == null ? null : actor.getEmail(), request.targetEmail()));
        log.setActorName(clean(actor == null ? null : actor.getFullName(), log.getActorEmail()));
        log.setTargetEmail(clean(request.targetEmail(), ""));
        log.setTargetName(clean(request.targetName(), ""));
        log.setCandidateId(request.candidateId());
        log.setCandidateName(clean(request.candidateName(), ""));
        log.setProjectTitle(clean(project.getTitle(), ""));
        log.setSeverity(clean(request.severity(), severityFor(request.type(), request.action())));
        log.setDetail(clean(request.detail(), ""));
        log.setCreatedAt(Instant.now());
        return activityRepository.save(log);
    }

    private HiringProject accessibleProject(UserAccount actor, Long projectId) {
        return projectRepository.findAccessibleById(projectId, actor.getId())
                .orElseThrow(() -> new IllegalArgumentException("Project not found or access denied"));
    }

    private HiringProject manageableProject(UserAccount actor, Long projectId) {
        HiringProject project = accessibleProject(actor, projectId);
        if (project.getOwner().getId().equals(actor.getId())) {
            return project;
        }
        String role = project.getOrganization() == null ? "" : membershipRepository.findByOrganizationIdAndUserId(project.getOrganization().getId(), actor.getId())
                .map(TeamMembership::getRole)
                .orElse("");
        if (List.of("Head Admin", "Admin", "Coordinator").contains(role)) {
            return project;
        }
        throw new IllegalArgumentException("Project Head Admin permissions required");
    }

    private void publish(HiringProject project) {
        if (project.getOwner() != null) {
            realtimeService.publishProject(project.getOwner());
        }
        if (project.getOrganization() != null) {
            realtimeService.publishProject(membershipRepository.findByOrganizationId(project.getOrganization().getId()).stream().map(TeamMembership::getUser).toList());
        }
    }

    private ProjectActivityResponse activityResponse(ProjectActivityLog row) {
        return new ProjectActivityResponse(row.getId(), row.getType(), row.getAction(), row.getActorEmail(), row.getActorName(), row.getTargetEmail(), row.getTargetName(), row.getCandidateId(), row.getCandidateName(), row.getProjectTitle(), row.getSeverity(), row.getDetail(), row.getCreatedAt());
    }

    private ProjectAtsTemplateResponse atsResponse(ProjectAtsTemplate row) {
        return new ProjectAtsTemplateResponse(row.getId(), row.getTemplateKey(), row.getName(), row.getVisibility(), row.isVerifiedDefault(), readMap(row.getTemplateJson()), row.getUpdatedAt());
    }

    private Map<String, Object> readMap(String json) {
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception ignored) {
            return defaultSettings();
        }
    }

    private List<String> readList(String json) {
        try {
            return objectMapper.readValue(json, STRING_LIST_TYPE);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Could not save project state");
        }
    }

    private Map<String, Object> merge(Map<String, Object> defaults, Map<String, Object> input) {
        Map<String, Object> merged = new LinkedHashMap<>(defaults);
        if (input != null) {
            merged.putAll(input);
        }
        return merged;
    }

    private Map<String, Object> defaultSettings() {
        return new LinkedHashMap<>(Map.ofEntries(
                Map.entry("projectVisibility", "Private workspace"),
                Map.entry("inviteApproval", "Head Admin approval"),
                Map.entry("defaultRole", "Reviewer"),
                Map.entry("defaultAuditState", "WAR_AI State"),
                Map.entry("atsTemplate", "Verified default ATS"),
                Map.entry("candidateIntake", "Manual + resume upload"),
                Map.entry("evidenceRequirement", "Require project/source evidence"),
                Map.entry("shortlistThreshold", 80),
                Map.entry("messageNotifications", true),
                Map.entry("exportBranding", true),
                Map.entry("activityLogging", true),
                Map.entry("retentionWindow", "Keep until deleted")
        ));
    }

    private String severityFor(String type, String action) {
        String value = ((type == null ? "" : type) + " " + (action == null ? "" : action)).toLowerCase(Locale.ROOT);
        if (value.contains("delete") || value.contains("kick") || value.contains("remove")) return "danger";
        if (value.contains("invite") || value.contains("create") || value.contains("accept")) return "good";
        if (value.contains("rank") || value.contains("role") || value.contains("permission")) return "warn";
        return "info";
    }

    private String clean(String value, String fallback) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }
}
