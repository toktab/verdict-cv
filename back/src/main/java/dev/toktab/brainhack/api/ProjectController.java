package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.hiring.HiringDtos.ImportResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectPageResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectRequest;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectResponse;
import dev.toktab.brainhack.hiring.HiringProjectService;
import dev.toktab.brainhack.hiring.HiringService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final HiringProjectService projectService;
    private final HiringService hiringService;

    public ProjectController(UserSessionService sessionService, AuthTokenResolver tokenResolver,
                             HiringProjectService projectService, HiringService hiringService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.projectService = projectService;
        this.hiringService = hiringService;
    }

    @GetMapping
    public List<ProjectResponse> list(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken) {
        return projectService.accessible(owner(authorization, legacyToken));
    }

    @PostMapping
    public ProjectResponse create(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @Valid @RequestBody ProjectRequest request) {
        return projectService.create(owner(authorization, legacyToken), request);
    }

    @PostMapping("/import-job-postings")
    public ImportResponse importJobPostings(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken) {
        return hiringService.importSamples(owner(authorization, legacyToken));
    }

    @GetMapping("/{projectId}")
    public ProjectResponse get(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId) {
        return projectService.project(owner(authorization, legacyToken), projectId);
    }

    @DeleteMapping("/{projectId}")
    public void delete(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId) {
        projectService.delete(owner(authorization, legacyToken), projectId);
    }

    @GetMapping("/page")
    public ProjectPageResponse page(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "") String search) {
        return projectService.page(owner(authorization, legacyToken), page, size, search);
    }

    private UserAccount owner(String authorization, String legacyToken) {
        return sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
