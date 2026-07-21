package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectActivityRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectActivityResponse;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectAnnouncementPinRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectAnnouncementRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectAnnouncementResponse;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectAtsTemplateRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectAtsTemplateResponse;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectMemberPermissionsRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectSettingsRequest;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectSettingsResponse;
import dev.toktab.brainhack.hiring.ProjectStateService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}")
public class ProjectSettingsController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final ProjectStateService projectStateService;

    public ProjectSettingsController(UserSessionService sessionService, AuthTokenResolver tokenResolver,
                                     ProjectStateService projectStateService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.projectStateService = projectStateService;
    }

    @GetMapping("/settings")
    public ProjectSettingsResponse settings(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId) {
        return projectStateService.settings(owner(authorization, legacyToken), projectId);
    }

    @PatchMapping("/settings")
    public ProjectSettingsResponse saveSettings(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @RequestBody ProjectSettingsRequest request) {
        return projectStateService.saveSettings(owner(authorization, legacyToken), projectId, request);
    }

    @GetMapping("/activity")
    public List<ProjectActivityResponse> activity(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId) {
        return projectStateService.activity(owner(authorization, legacyToken), projectId);
    }

    @PostMapping("/activity")
    public ProjectActivityResponse recordActivity(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @Valid @RequestBody ProjectActivityRequest request) {
        return projectStateService.record(owner(authorization, legacyToken), projectId, request);
    }

    @GetMapping("/announcements")
    public List<ProjectAnnouncementResponse> announcements(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId) {
        return projectStateService.announcements(owner(authorization, legacyToken), projectId);
    }

    @PostMapping("/announcements")
    public ProjectAnnouncementResponse createAnnouncement(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @Valid @RequestBody ProjectAnnouncementRequest request) {
        return projectStateService.createAnnouncement(owner(authorization, legacyToken), projectId, request);
    }

    @PatchMapping("/announcements/{announcementId}")
    public ProjectAnnouncementResponse pinAnnouncement(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long announcementId,
            @RequestBody ProjectAnnouncementPinRequest request) {
        return projectStateService.pinAnnouncement(owner(authorization, legacyToken), projectId, announcementId, request);
    }

    @DeleteMapping("/announcements/{announcementId}")
    public void deleteAnnouncement(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long announcementId) {
        projectStateService.deleteAnnouncement(owner(authorization, legacyToken), projectId, announcementId);
    }

    @GetMapping("/ats-templates")
    public List<ProjectAtsTemplateResponse> atsTemplates(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId) {
        return projectStateService.atsTemplates(owner(authorization, legacyToken), projectId);
    }

    @PostMapping("/ats-templates")
    public List<ProjectAtsTemplateResponse> saveAtsTemplates(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @RequestBody List<ProjectAtsTemplateRequest> request) {
        return projectStateService.saveAtsTemplates(owner(authorization, legacyToken), projectId, request);
    }

    @GetMapping("/members/permissions")
    public Map<String, List<String>> memberPermissions(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId) {
        return projectStateService.memberPermissions(owner(authorization, legacyToken), projectId);
    }

    @PatchMapping("/members/permissions")
    public Map<String, List<String>> saveMemberPermissions(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @Valid @RequestBody ProjectMemberPermissionsRequest request) {
        return projectStateService.saveMemberPermissions(owner(authorization, legacyToken), projectId, request);
    }

    private UserAccount owner(String authorization, String legacyToken) {
        return sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
