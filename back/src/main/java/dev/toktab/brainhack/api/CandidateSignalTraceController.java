package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.hiring.CandidateOsintService;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunRequest;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}/candidates/{candidateId}/osint")
public class CandidateSignalTraceController {
    private final UserSessionService sessionService;
    private final AuthTokenResolver tokenResolver;
    private final CandidateOsintService osintService;

    public CandidateSignalTraceController(UserSessionService sessionService, AuthTokenResolver tokenResolver,
                                          CandidateOsintService osintService) {
        this.sessionService = sessionService;
        this.tokenResolver = tokenResolver;
        this.osintService = osintService;
    }

    @PostMapping("/run")
    public OsintRunResponse runOsint(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId,
            @RequestBody(required = false) OsintRunRequest request) {
        return osintService.runOsint(owner(authorization, legacyToken), projectId, candidateId, request);
    }

    @GetMapping("/latest")
    public ResponseEntity<OsintRunResponse> latestOsint(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String legacyToken,
            @PathVariable Long projectId,
            @PathVariable Long candidateId) {
        return ResponseEntity.ofNullable(
                osintService.latestOsint(owner(authorization, legacyToken), projectId, candidateId));
    }

    private UserAccount owner(String authorization, String legacyToken) {
        return sessionService.me(tokenResolver.userToken(authorization, legacyToken, null));
    }
}
