package dev.toktab.brainhack.api;

import dev.toktab.brainhack.api.dto.AuditResponse;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.AuditSummaryResponse;
import dev.toktab.brainhack.audit.AuditMapper;
import dev.toktab.brainhack.audit.AuditService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit")
public class AuditController {
    private final AuditService auditService;
    private final AuditMapper auditMapper;
    private final ExportService exportService;

    public AuditController(AuditService auditService, AuditMapper auditMapper, ExportService exportService) {
        this.auditService = auditService;
        this.auditMapper = auditMapper;
        this.exportService = exportService;
    }

    @PostMapping("/run")
    public AuditResponse run(@Valid @RequestBody AuditRunRequest request, HttpServletRequest httpRequest) {
        return auditMapper.toResponse(auditService.run(request, httpRequest));
    }

    @GetMapping("/{id}")
    public AuditResponse get(@PathVariable Long id) {
        return auditMapper.toResponse(auditService.get(id));
    }

    @GetMapping("/{id}/summary")
    public AuditSummaryResponse summary(@PathVariable Long id) {
        return auditMapper.toSummary(auditService.get(id));
    }

    @GetMapping("/history")
    public List<AuditSummaryResponse> history() {
        return auditService.history().stream().map(auditMapper::toSummary).toList();
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<String> export(@PathVariable Long id) {
        String body = exportService.export(auditService.get(id));
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=verdict-audit-" + id + ".txt")
                .body(body);
    }
}
