package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.hiring.CandidateWorkflowService;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateStatusRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateWorkflowResponse;
import dev.toktab.brainhack.hiring.HiringDtos.NoteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.NoteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.VoteRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}/candidates/{candidateId}")
public class CandidateReviewController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final CandidateWorkflowService workflowService;

    public CandidateReviewController(UserSessionService sessionService, AuthTokenResolver tokenResolver,
                                     CandidateWorkflowService workflowService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.workflowService = workflowService;
    }

    @GetMapping("/notes")
    public List<NoteResponse> notes(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId) {
        return workflowService.notes(owner(authorization, legacyToken), projectId, candidateId);
    }

    @PostMapping("/notes")
    public NoteResponse addNote(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId,
            @Valid @RequestBody NoteRequest request) {
        return workflowService.addNote(owner(authorization, legacyToken), projectId, candidateId, request);
    }

    @GetMapping("/workflow")
    public CandidateWorkflowResponse workflow(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId) {
        return workflowService.workflow(owner(authorization, legacyToken), projectId, candidateId);
    }

    @PostMapping("/votes")
    public CandidateWorkflowResponse vote(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId,
            @Valid @RequestBody VoteRequest request) {
        return workflowService.vote(owner(authorization, legacyToken), projectId, candidateId, request);
    }

    @PatchMapping("/status")
    public CandidateWorkflowResponse updateStatus(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId,
            @Valid @RequestBody CandidateStatusRequest request) {
        return workflowService.updateStatus(owner(authorization, legacyToken), projectId, candidateId, request);
    }

    private UserAccount owner(String authorization, String legacyToken) {
        return sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
