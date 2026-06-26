package dev.toktab.brainhack.api;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserTokenService;
import dev.toktab.brainhack.api.dto.AuditResponse;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.AuditSummaryResponse;
import dev.toktab.brainhack.api.dto.AuditTemplateRequest;
import dev.toktab.brainhack.api.dto.AuditTemplateResponse;
import dev.toktab.brainhack.audit.AuditMapper;
import dev.toktab.brainhack.audit.AuditService;
import dev.toktab.brainhack.audit.AuditTemplateService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit")
public class AuditController {
    private final AuditService auditService;
    private final AuditMapper auditMapper;
    private final ExportService exportService;
    private final UserTokenService userTokenService;
    private final AuditTemplateService templateService;

    public AuditController(AuditService auditService, AuditMapper auditMapper, ExportService exportService, UserTokenService userTokenService, AuditTemplateService templateService) {
        this.auditService = auditService;
        this.auditMapper = auditMapper;
        this.exportService = exportService;
        this.userTokenService = userTokenService;
        this.templateService = templateService;
    }

    @PostMapping("/run")
    public AuditResponse run(@Valid @RequestBody AuditRunRequest request, @RequestHeader(value = "X-User-Token", required = false) String token, HttpServletRequest httpRequest) {
        UserAccount user = userTokenService.requireUser(token);
        return auditMapper.toResponse(auditService.run(request, httpRequest, user));
    }

    @PostMapping("/run-async")
    public AuditResponse runAsync(@Valid @RequestBody AuditRunRequest request, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(token);
        return auditMapper.toResponse(auditService.startAsync(request, user));
    }

    @GetMapping("/templates")
    public List<AuditTemplateResponse> templates(@RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(token);
        return templateService.templatesFor(user);
    }

    @PostMapping("/templates")
    public AuditTemplateResponse createTemplate(@Valid @RequestBody AuditTemplateRequest request, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(token);
        return templateService.create(user, request);
    }

    @GetMapping("/{id}")
    public AuditResponse get(@PathVariable Long id, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(token);
        return auditMapper.toResponse(auditService.getForUser(id, user));
    }

    @GetMapping("/{id}/summary")
    public AuditSummaryResponse summary(@PathVariable Long id, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(token);
        return auditMapper.toSummary(auditService.getForUser(id, user));
    }

    @GetMapping("/history")
    public List<AuditSummaryResponse> history(@RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(token);
        return auditService.historyForUser(user).stream().map(auditMapper::toSummary).toList();
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<String> export(@PathVariable Long id, @RequestHeader(value = "X-User-Token", required = false) String token) {
        UserAccount user = userTokenService.requireUser(token);
        String body = exportService.export(auditService.getForUser(id, user));
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=verdict-audit-" + id + ".txt")
                .body(body);
    }
}
