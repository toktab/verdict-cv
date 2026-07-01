package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserTokenService;
import dev.toktab.brainhack.account.AuthTokenResolver;
import dev.toktab.brainhack.api.dto.AuditResponse;
import dev.toktab.brainhack.api.dto.AuditProgressResponse;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.AuditSnapshotResponse;
import dev.toktab.brainhack.api.dto.AuditSummaryResponse;
import dev.toktab.brainhack.api.dto.AuditTemplateRequest;
import dev.toktab.brainhack.api.dto.AuditTemplateResponse;
import dev.toktab.brainhack.api.dto.CheckStateResponse;
import dev.toktab.brainhack.api.dto.VerdictOverrideRequest;
import dev.toktab.brainhack.audit.AuditMapper;
import dev.toktab.brainhack.audit.AuditService;
import dev.toktab.brainhack.audit.AuditTemplateService;
import dev.toktab.brainhack.audit.CheckStateService;
import dev.toktab.brainhack.audit.ExportService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit")
public class AuditController {
    private final AuditService auditService;
    private final AuditMapper auditMapper;
    private final ExportService exportService;
    private final UserTokenService userTokenService;
    private final AuthTokenResolver tokenResolver;
    private final AuditTemplateService templateService;
    private final CheckStateService checkStateService;

    public AuditController(AuditService auditService, AuditMapper auditMapper, ExportService exportService, UserTokenService userTokenService, AuthTokenResolver tokenResolver, AuditTemplateService templateService, CheckStateService checkStateService) {
        this.auditService = auditService;
        this.auditMapper = auditMapper;
        this.exportService = exportService;
        this.userTokenService = userTokenService;
        this.tokenResolver = tokenResolver;
        this.templateService = templateService;
        this.checkStateService = checkStateService;
    }

    @PostMapping("/run")
    public AuditResponse run(@Valid @RequestBody AuditRunRequest request, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token, HttpServletRequest httpRequest) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return auditMapper.toResponse(auditService.run(request, httpRequest, user));
    }

    @PostMapping("/run-async")
    public AuditResponse runAsync(@Valid @RequestBody AuditRunRequest request, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return auditMapper.toResponse(auditService.startAsync(request, user));
    }

    @GetMapping("/templates")
    public List<AuditTemplateResponse> templates(@RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return templateService.templatesFor(user);
    }

    @PostMapping("/templates")
    public AuditTemplateResponse createTemplate(@Valid @RequestBody AuditTemplateRequest request, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return templateService.create(user, request);
    }

    @GetMapping("/states")
    public List<CheckStateResponse> states(@RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return checkStateService.states();
    }

    @GetMapping("/{id}")
    public AuditResponse get(@PathVariable Long id, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return auditMapper.toResponse(auditService.getForUser(id, user));
    }

    @GetMapping("/{id}/summary")
    public AuditSummaryResponse summary(@PathVariable Long id, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return auditMapper.toSummary(auditService.getForUser(id, user));
    }

    @GetMapping("/{id}/progress")
    public AuditProgressResponse progress(@PathVariable Long id, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return auditMapper.toProgress(auditService.getForUser(id, user));
    }

    @PostMapping("/{id}/cancel")
    public AuditProgressResponse cancel(@PathVariable Long id, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return auditMapper.toProgress(auditService.cancel(id, user));
    }

    @GetMapping("/{id}/snapshot")
    public AuditSnapshotResponse snapshot(@PathVariable Long id, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return auditService.latestSnapshot(id, user);
    }

    @PostMapping("/{id}/verdicts/{verdictId}/override")
    public AuditResponse overrideVerdict(
            @PathVariable Long id,
            @PathVariable Long verdictId,
            @Valid @RequestBody VerdictOverrideRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return auditMapper.toResponse(auditService.overrideVerdict(id, verdictId, user, request));
    }

    @GetMapping("/history")
    public List<AuditSummaryResponse> history(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-User-Token", required = false) String token,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "100") int limit) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        return auditService.historyForUser(user, offset, limit).stream().map(auditMapper::toSummary).toList();
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable Long id, @RequestParam(defaultValue = "txt") String format, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(tokenResolver.userToken(authorization, token, null));
        ExportService.ExportFile file = exportService.export(auditService.getForUser(id, user), format);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .body(file.body());
    }
}
