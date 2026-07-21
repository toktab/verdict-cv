package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.hiring.CandidateIntakeService;
import dev.toktab.brainhack.hiring.CandidateAnalysisService;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateAnalysisStateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidatePageResponse;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import jakarta.validation.Valid;
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
@RequestMapping("/api/projects/{projectId}/candidates")
public class CandidateController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final CandidateIntakeService candidateService;
    private final CandidateAnalysisService analysisService;

    public CandidateController(UserSessionService sessionService, AuthTokenResolver tokenResolver,
                               CandidateIntakeService candidateService,
                               CandidateAnalysisService analysisService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.candidateService = candidateService;
        this.analysisService = analysisService;
    }

    @GetMapping
    public CandidatePageResponse candidates(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "25") int limit) {
        return candidateService.candidates(owner(authorization, legacyToken), projectId, offset, limit);
    }

    @PostMapping
    public CandidateResponse addCandidate(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @Valid @RequestBody CandidateRequest request) {
        return candidateService.addCandidate(owner(authorization, legacyToken), projectId, request);
    }

    @PostMapping("/upload")
    public CandidateResponse uploadCandidate(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "role", required = false) String role,
            @RequestPart("resume") MultipartFile resume) {
        return candidateService.uploadCandidate(owner(authorization, legacyToken), projectId, name, role, resume);
    }

    @GetMapping("/{candidateId}")
    public CandidateResponse candidate(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId) {
        return candidateService.candidate(owner(authorization, legacyToken), projectId, candidateId);
    }

    @PostMapping("/{candidateId}/reanalyze")
    public CandidateResponse reanalyzeCandidate(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId) {
        return analysisService.reanalyze(owner(authorization, legacyToken), projectId, candidateId);
    }

    @PatchMapping("/{candidateId}/analysis-state")
    public CandidateResponse updateCandidateAnalysisState(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId,
            @Valid @RequestBody CandidateAnalysisStateRequest request) {
        return analysisService.updateAnalysisState(
                owner(authorization, legacyToken), projectId, candidateId, request);
    }

    @DeleteMapping("/{candidateId}")
    public void deleteCandidate(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId) {
        candidateService.deleteCandidate(owner(authorization, legacyToken), projectId, candidateId);
    }

    private UserAccount owner(String authorization, String legacyToken) {
        return sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
