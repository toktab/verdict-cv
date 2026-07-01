package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateStatusRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateWorkflowResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ImportResponse;
import dev.toktab.brainhack.hiring.HiringDtos.InviteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.InviteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.NoteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.NoteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunRequest;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectMemberResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectRequest;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectResponse;
import dev.toktab.brainhack.hiring.HiringDtos.VoteRequest;
import dev.toktab.brainhack.hiring.HiringService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/projects")
public class HiringController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final HiringService hiringService;

    public HiringController(UserSessionService sessionService, AuthTokenResolver tokenResolver, HiringService hiringService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.hiringService = hiringService;
    }

    @GetMapping
    public List<ProjectResponse> list(@RequestHeader(value = "Authorization", required = false) String authorization,
                                      @RequestHeader(value = "X-User-Token", required = false) String legacyToken) {
        return hiringService.projects(owner(authorization, legacyToken));
    }

    @PostMapping
    public ProjectResponse create(@RequestHeader(value = "Authorization", required = false) String authorization,
                                  @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                  @Valid @RequestBody ProjectRequest request) {
        return hiringService.createProject(owner(authorization, legacyToken), request);
    }

    @PostMapping("/import-job-postings")
    public ImportResponse importJobPostings(@RequestHeader(value = "Authorization", required = false) String authorization,
                                            @RequestHeader(value = "X-User-Token", required = false) String legacyToken) {
        return hiringService.importSamples(owner(authorization, legacyToken));
    }

    @GetMapping("/{projectId}")
    public ProjectResponse get(@RequestHeader(value = "Authorization", required = false) String authorization,
                               @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                               @PathVariable Long projectId) {
        return hiringService.project(owner(authorization, legacyToken), projectId);
    }

    @DeleteMapping("/{projectId}")
    public void delete(@RequestHeader(value = "Authorization", required = false) String authorization,
                       @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                       @PathVariable Long projectId) {
        hiringService.deleteProject(owner(authorization, legacyToken), projectId);
    }

    @PostMapping("/{projectId}/candidates")
    public CandidateResponse addCandidate(@RequestHeader(value = "Authorization", required = false) String authorization,
                                          @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                          @PathVariable Long projectId,
                                          @Valid @RequestBody CandidateRequest request) {
        return hiringService.addCandidate(owner(authorization, legacyToken), projectId, request);
    }

    @PostMapping("/{projectId}/candidates/upload")
    public CandidateResponse uploadCandidate(@RequestHeader(value = "Authorization", required = false) String authorization,
                                             @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                             @PathVariable Long projectId,
                                             @RequestParam(value = "name", required = false) String name,
                                             @RequestParam(value = "role", required = false) String role,
                                             @RequestPart("resume") MultipartFile resume) {
        return hiringService.uploadCandidate(owner(authorization, legacyToken), projectId, name, role, resume);
    }

    @GetMapping("/{projectId}/candidates/{candidateId}")
    public CandidateResponse candidate(@RequestHeader(value = "Authorization", required = false) String authorization,
                                       @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                       @PathVariable Long projectId,
                                       @PathVariable Long candidateId) {
        return hiringService.candidate(owner(authorization, legacyToken), projectId, candidateId);
    }

    @PostMapping("/{projectId}/candidates/{candidateId}/reanalyze")
    public CandidateResponse reanalyzeCandidate(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                                @PathVariable Long projectId,
                                                @PathVariable Long candidateId) {
        return hiringService.reanalyzeCandidate(owner(authorization, legacyToken), projectId, candidateId);
    }

    @PostMapping("/{projectId}/candidates/{candidateId}/osint/run")
    public OsintRunResponse runOsint(@RequestHeader(value = "Authorization", required = false) String authorization,
                                     @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                     @PathVariable Long projectId,
                                     @PathVariable Long candidateId,
                                     @RequestBody(required = false) OsintRunRequest request) {
        return hiringService.runOsint(owner(authorization, legacyToken), projectId, candidateId, request);
    }

    @DeleteMapping("/{projectId}/candidates/{candidateId}")
    public void deleteCandidate(@RequestHeader(value = "Authorization", required = false) String authorization,
                                @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                @PathVariable Long projectId,
                                @PathVariable Long candidateId) {
        hiringService.deleteCandidate(owner(authorization, legacyToken), projectId, candidateId);
    }

    @GetMapping("/{projectId}/invites")
    public List<InviteResponse> invites(@RequestHeader(value = "Authorization", required = false) String authorization,
                                        @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                        @PathVariable Long projectId) {
        return hiringService.invites(owner(authorization, legacyToken), projectId);
    }

    @GetMapping("/{projectId}/members")
    public List<ProjectMemberResponse> members(@RequestHeader(value = "Authorization", required = false) String authorization,
                                               @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                               @PathVariable Long projectId) {
        return hiringService.members(owner(authorization, legacyToken), projectId);
    }

    @PostMapping("/{projectId}/invites")
    public InviteResponse invite(@RequestHeader(value = "Authorization", required = false) String authorization,
                                 @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                 @PathVariable Long projectId,
                                 @Valid @RequestBody InviteRequest request) {
        return hiringService.invite(owner(authorization, legacyToken), projectId, request);
    }

    @PostMapping("/invites/accept")
    public InviteResponse acceptInvite(@RequestHeader(value = "Authorization", required = false) String authorization,
                                       @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                       @RequestParam String token) {
        return hiringService.acceptInvite(owner(authorization, legacyToken), token);
    }

    @GetMapping("/{projectId}/candidates/{candidateId}/notes")
    public List<NoteResponse> notes(@RequestHeader(value = "Authorization", required = false) String authorization,
                                    @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                    @PathVariable Long projectId,
                                    @PathVariable Long candidateId) {
        return hiringService.notes(owner(authorization, legacyToken), projectId, candidateId);
    }

    @PostMapping("/{projectId}/candidates/{candidateId}/notes")
    public NoteResponse addNote(@RequestHeader(value = "Authorization", required = false) String authorization,
                                @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                @PathVariable Long projectId,
                                @PathVariable Long candidateId,
                                @Valid @RequestBody NoteRequest request) {
        return hiringService.addNote(owner(authorization, legacyToken), projectId, candidateId, request);
    }

    @GetMapping("/{projectId}/candidates/{candidateId}/workflow")
    public CandidateWorkflowResponse workflow(@RequestHeader(value = "Authorization", required = false) String authorization,
                                              @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                              @PathVariable Long projectId,
                                              @PathVariable Long candidateId) {
        return hiringService.workflow(owner(authorization, legacyToken), projectId, candidateId);
    }

    @PostMapping("/{projectId}/candidates/{candidateId}/votes")
    public CandidateWorkflowResponse vote(@RequestHeader(value = "Authorization", required = false) String authorization,
                                          @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                          @PathVariable Long projectId,
                                          @PathVariable Long candidateId,
                                          @Valid @RequestBody VoteRequest request) {
        return hiringService.vote(owner(authorization, legacyToken), projectId, candidateId, request);
    }

    @PatchMapping("/{projectId}/candidates/{candidateId}/status")
    public CandidateWorkflowResponse updateStatus(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                  @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
                                                  @PathVariable Long projectId,
                                                  @PathVariable Long candidateId,
                                                  @Valid @RequestBody CandidateStatusRequest request) {
        return hiringService.updateCandidateStatus(owner(authorization, legacyToken), projectId, candidateId, request);
    }

    private UserAccount owner(String authorization, String legacyToken) {
        return sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
