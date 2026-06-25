package dev.toktab.brainhack.api;

import dev.toktab.brainhack.admin.AdminSessionService;
import dev.toktab.brainhack.api.dto.AdminLoginRequest;
import dev.toktab.brainhack.api.dto.AdminLoginResponse;
import dev.toktab.brainhack.api.dto.AuditResponse;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.VerdictResponse;
import dev.toktab.brainhack.audit.AuditMapper;
import dev.toktab.brainhack.audit.AuditService;
import dev.toktab.brainhack.audit.Verdict;
import dev.toktab.brainhack.audit.VerdictRepository;
import dev.toktab.brainhack.log.AppEventLog;
import dev.toktab.brainhack.log.AppEventLogRepository;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminSessionService adminSessionService;
    private final AuditService auditService;
    private final AuditMapper auditMapper;
    private final VerdictRepository verdictRepository;
    private final AppEventLogRepository logRepository;
    private final AuditLogService logService;

    public AdminController(
            AdminSessionService adminSessionService,
            AuditService auditService,
            AuditMapper auditMapper,
            VerdictRepository verdictRepository,
            AppEventLogRepository logRepository,
            AuditLogService logService) {
        this.adminSessionService = adminSessionService;
        this.auditService = auditService;
        this.auditMapper = auditMapper;
        this.verdictRepository = verdictRepository;
        this.logRepository = logRepository;
        this.logService = logService;
    }

    @PostMapping("/login")
    public AdminLoginResponse login(@Valid @RequestBody AdminLoginRequest request, HttpServletRequest httpRequest) {
        String token = adminSessionService.login(request.username(), request.password());
        logService.record("ADMIN_LOGIN", httpRequest, 200, 0, request.username(), "admin logged in");
        return new AdminLoginResponse(token, adminSessionService.username());
    }

    @GetMapping("/audits")
    public List<AuditResponse> audits() {
        return auditService.history().stream().map(auditMapper::toResponse).toList();
    }

    @PostMapping("/audits")
    public AuditResponse createAudit(@Valid @RequestBody AuditRunRequest request, HttpServletRequest httpRequest) {
        return auditMapper.toResponse(auditService.run(request, httpRequest));
    }

    @DeleteMapping("/audits/{id}")
    public void deleteAudit(@PathVariable Long id) {
        auditService.delete(id);
        logService.recordSystem("ADMIN_DELETE_AUDIT", "auditId=" + id);
    }

    @PatchMapping("/verdicts/{id}")
    @Transactional
    public VerdictResponse updateVerdict(@PathVariable Long id, @RequestBody Verdict patch) {
        Verdict verdict = verdictRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Verdict not found: " + id));
        if (patch.getStatus() != null) {
            verdict.setStatus(patch.getStatus());
        }
        if (patch.getConfidence() != null) {
            verdict.setConfidence(patch.getConfidence());
        }
        if (patch.getReasonCategory() != null) {
            verdict.setReasonCategory(patch.getReasonCategory());
        }
        if (patch.getExplanation() != null) {
            verdict.setExplanation(patch.getExplanation());
        }
        if (patch.getEvidencePointer() != null) {
            verdict.setEvidencePointer(patch.getEvidencePointer());
        }
        logService.recordSystem("ADMIN_UPDATE_VERDICT", "verdictId=" + id);
        Verdict saved = verdictRepository.save(verdict);
        auditService.recalculate(saved.getAudit().getId());
        return auditMapper.toVerdictResponse(saved);
    }

    @DeleteMapping("/verdicts/{id}")
    @Transactional
    public void deleteVerdict(@PathVariable Long id) {
        Verdict verdict = verdictRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Verdict not found: " + id));
        Long auditId = verdict.getAudit().getId();
        verdict.getAudit().getVerdicts().removeIf(item -> id.equals(item.getId()));
        auditService.recalculate(auditId);
        logService.recordSystem("ADMIN_DELETE_VERDICT", "verdictId=" + id);
    }

    @GetMapping("/logs")
    public List<AppEventLog> logs() {
        return logRepository.findTop250ByOrderByCreatedAtDesc();
    }

    @DeleteMapping("/logs/{id}")
    public void deleteLog(@PathVariable Long id) {
        logRepository.deleteById(id);
    }
}
