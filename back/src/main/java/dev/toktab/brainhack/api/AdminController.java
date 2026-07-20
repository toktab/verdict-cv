package dev.toktab.brainhack.api;

import dev.toktab.brainhack.admin.AdminSessionService;
import dev.toktab.brainhack.admin.AdminTableMaintenanceService;
import dev.toktab.brainhack.admin.AdminTableMaintenanceService.TableClearResult;
import dev.toktab.brainhack.admin.AdminHealthService;
import dev.toktab.brainhack.admin.AdminHealthService.AdminHealthResponse;
import dev.toktab.brainhack.account.AccountSettingsService;
import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.account.UserMapper;
import dev.toktab.brainhack.api.dto.AdminLoginRequest;
import dev.toktab.brainhack.api.dto.AdminLoginResponse;
import dev.toktab.brainhack.api.dto.AdminSettingsRequest;
import dev.toktab.brainhack.api.dto.AdminSettingsResponse;
import dev.toktab.brainhack.api.dto.AuditResponse;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.UserAdminRequest;
import dev.toktab.brainhack.api.dto.UserResponse;
import dev.toktab.brainhack.api.dto.VerdictResponse;
import dev.toktab.brainhack.audit.AuditMapper;
import dev.toktab.brainhack.audit.AuditService;
import dev.toktab.brainhack.audit.Verdict;
import dev.toktab.brainhack.audit.VerdictRepository;
import dev.toktab.brainhack.audit.VerdictRevisionService;
import dev.toktab.brainhack.ats.AtsKeywordCatalog;
import dev.toktab.brainhack.ats.AtsKeywordCatalog.OfficialAtsVersionResponse;
import dev.toktab.brainhack.log.AppEventLog;
import dev.toktab.brainhack.log.AppEventLogRepository;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    private final UserAccountService userAccountService;
    private final UserMapper userMapper;
    private final AccountSettingsService accountSettingsService;
    private final AdminTableMaintenanceService tableMaintenanceService;
    private final AdminHealthService adminHealthService;
    private final AtsKeywordCatalog atsKeywordCatalog;
    private final VerdictRevisionService verdictRevisionService;

    public AdminController(
            AdminSessionService adminSessionService,
            AuditService auditService,
            AuditMapper auditMapper,
            VerdictRepository verdictRepository,
            AppEventLogRepository logRepository,
            AuditLogService logService,
            UserAccountService userAccountService,
            UserMapper userMapper,
            AccountSettingsService accountSettingsService,
            AdminTableMaintenanceService tableMaintenanceService,
            AdminHealthService adminHealthService,
            AtsKeywordCatalog atsKeywordCatalog,
            VerdictRevisionService verdictRevisionService) {
        this.adminSessionService = adminSessionService;
        this.auditService = auditService;
        this.auditMapper = auditMapper;
        this.verdictRepository = verdictRepository;
        this.logRepository = logRepository;
        this.logService = logService;
        this.userAccountService = userAccountService;
        this.userMapper = userMapper;
        this.accountSettingsService = accountSettingsService;
        this.tableMaintenanceService = tableMaintenanceService;
        this.adminHealthService = adminHealthService;
        this.atsKeywordCatalog = atsKeywordCatalog;
        this.verdictRevisionService = verdictRevisionService;
    }

    @PostMapping("/login")
    public AdminLoginResponse login(@Valid @RequestBody AdminLoginRequest request, HttpServletRequest httpRequest) {
        String token = adminSessionService.login(request.username(), request.password());
        logService.record("ADMIN_LOGIN", httpRequest, 200, 0, request.username(), "admin logged in");
        return new AdminLoginResponse(token, adminSessionService.username());
    }

    @GetMapping("/audits")
    public List<AuditResponse> audits(@RequestParam(defaultValue = "0") int offset, @RequestParam(defaultValue = "20") int limit, @RequestParam(defaultValue = "") String search) {
        return auditService.history(search, offset, limit).stream()
                .map(auditMapper::toResponse)
                .toList();
    }

    @GetMapping("/audits/{id}")
    public AuditResponse audit(@PathVariable Long id) {
        return auditMapper.toResponse(auditService.getWithVerdicts(id));
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

    @GetMapping("/users")
    public List<UserResponse> users(@RequestParam(defaultValue = "0") int offset, @RequestParam(defaultValue = "20") int limit, @RequestParam(defaultValue = "") String search) {
        return userAccountService.users(search, offset, limit).stream()
                .map(userMapper::toResponse)
                .toList();
    }

    @PostMapping("/users")
    public UserResponse createUser(@Valid @RequestBody UserAdminRequest request) {
        UserAccount user = userAccountService.create(request);
        logService.recordSystem("ADMIN_CREATE_USER", "userId=" + user.getId());
        return userMapper.toResponse(user);
    }

    @PatchMapping("/users/{id}")
    public UserResponse updateUser(@PathVariable Long id, @Valid @RequestBody UserAdminRequest request) {
        UserAccount user = userAccountService.update(id, request);
        logService.recordSystem("ADMIN_UPDATE_USER", "userId=" + id);
        return userMapper.toResponse(user);
    }

    @DeleteMapping("/users/{id}")
    public void deleteUser(@PathVariable Long id) {
        userAccountService.delete(id);
        logService.recordSystem("ADMIN_DELETE_USER", "userId=" + id);
    }

    @GetMapping("/settings")
    public AdminSettingsResponse settings() {
        return new AdminSettingsResponse(accountSettingsService.requireEmailVerification());
    }

    @GetMapping("/health")
    public AdminHealthResponse health() {
        return adminHealthService.health();
    }

    @PatchMapping("/settings")
    public AdminSettingsResponse updateSettings(@RequestBody AdminSettingsRequest request) {
        boolean required = accountSettingsService.setRequireEmailVerification(request.requireEmailVerification());
        logService.recordSystem("ADMIN_UPDATE_SETTINGS", "requireEmailVerification=" + required);
        return new AdminSettingsResponse(required);
    }

    @GetMapping("/ats-templates")
    public List<OfficialAtsVersionResponse> officialAtsTemplates() {
        return atsKeywordCatalog.versions();
    }

    @PostMapping("/ats-templates")
    public OfficialAtsVersionResponse publishOfficialAtsTemplate(@RequestBody OfficialAtsPublishRequest request) {
        OfficialAtsVersionResponse published = atsKeywordCatalog.publish(request.catalogJson(), request.changeNote(), adminSessionService.username());
        logService.recordSystem("ADMIN_PUBLISH_ATS_TEMPLATE", "version=" + published.version() + ", note=" + published.changeNote());
        return published;
    }

    @PostMapping("/ats-templates/{id}/rollback")
    public OfficialAtsVersionResponse rollbackOfficialAtsTemplate(@PathVariable Long id, @RequestBody OfficialAtsRollbackRequest request) {
        OfficialAtsVersionResponse published = atsKeywordCatalog.rollback(id, request.changeNote(), adminSessionService.username());
        logService.recordSystem("ADMIN_ROLLBACK_ATS_TEMPLATE", "sourceId=" + id + ", newVersion=" + published.version());
        return published;
    }

    @PatchMapping("/verdicts/{id}")
    @Transactional
    public VerdictResponse updateVerdict(@PathVariable Long id, @RequestBody Verdict patch) {
        Verdict verdict = verdictRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Verdict not found: " + id));
        Map<String, Object> changes = new LinkedHashMap<>();
        if (patch.getStatus() != null) {
            changes.put("status", patch.getStatus().name());
        }
        if (patch.getConfidence() != null) {
            changes.put("confidence", patch.getConfidence().name());
        }
        if (patch.getReasonCategory() != null) {
            changes.put("reasonCategory", patch.getReasonCategory());
        }
        if (patch.getExplanation() != null) {
            changes.put("explanation", patch.getExplanation());
        }
        if (patch.getEvidencePointer() != null) {
            changes.put("evidencePointer", patch.getEvidencePointer());
        }
        verdictRevisionService.appendAdminPatch(verdict, adminSessionService.username(), changes, "Administrative verdict correction");
        logService.recordSystem("ADMIN_UPDATE_VERDICT", "verdictId=" + id);
        auditService.recalculate(verdict.getAudit().getId());
        return auditMapper.toVerdictResponse(verdict);
    }

    @DeleteMapping("/verdicts/{id}")
    @Transactional
    public void deleteVerdict(@PathVariable Long id) {
        Verdict verdict = verdictRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Verdict not found: " + id));
        Long auditId = verdict.getAudit().getId();
        verdictRevisionService.appendAdminPatch(verdict, adminSessionService.username(), Map.of("deleted", true), "Administrative soft delete");
        auditService.recalculate(auditId);
        logService.recordSystem("ADMIN_DELETE_VERDICT", "verdictId=" + id);
    }

    @GetMapping("/logs")
    public List<AppEventLog> logs(@RequestParam(defaultValue = "0") int offset, @RequestParam(defaultValue = "20") int limit, @RequestParam(defaultValue = "") String search) {
        String needle = search == null ? "" : search.trim().toLowerCase();
        Pageable pageable = PageRequest.of(safeOffset(offset) / safeLimit(limit), safeLimit(limit), Sort.by(Sort.Direction.DESC, "createdAt"));
        return needle.isBlank()
                ? logRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable)
                : logRepository.search(needle, pageable);
    }

    @DeleteMapping("/logs/{id}")
    public void deleteLog(@PathVariable Long id) {
        AppEventLog log = logRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Log not found: " + id));
        log.setDeletedAt(Instant.now());
        logRepository.save(log);
    }

    @GetMapping("/table-clear-targets")
    public List<TableClearResult> tableClearTargets() {
        return tableMaintenanceService.targets();
    }

    @PostMapping("/clear-tables")
    public List<TableClearResult> clearTables(@RequestBody ClearTablesRequest request, HttpServletRequest httpRequest) {
        long started = System.currentTimeMillis();
        String requiredPhrase = request.targets() == null ? "" : request.targets().stream()
                .map(value -> value == null ? "" : value.trim().toLowerCase())
                .filter(value -> !value.isBlank())
                .reduce((left, right) -> left + " + " + right)
                .orElse("");
        if (requiredPhrase.isBlank() || !requiredPhrase.equals(request.confirmation() == null ? "" : request.confirmation().trim().toLowerCase())) {
            throw new IllegalArgumentException("Type the exact selected table keys before clearing: " + requiredPhrase);
        }
        List<TableClearResult> selected = tableMaintenanceService.targets().stream()
                .filter(target -> request.targets().stream().anyMatch(value -> target.key().equalsIgnoreCase(value == null ? "" : value.trim())))
                .toList();
        int affectedRows = selected.stream().mapToInt(TableClearResult::deletedRows).sum();
        List<TableClearResult> results = tableMaintenanceService.clear(request.targets());
        int deletedRows = results.stream().mapToInt(TableClearResult::deletedRows).sum();
        logService.record(
                "ADMIN_CLEAR_TABLES",
                httpRequest,
                200,
                System.currentTimeMillis() - started,
                adminSessionService.username(),
                "targets=" + request.targets()
                        + "; affectedRowsBefore=" + affectedRows
                        + "; deletedRows=" + deletedRows
                        + "; timestamp=" + Instant.now());
        return results;
    }

    private int safeOffset(int offset) {
        return Math.max(offset, 0);
    }

    private int safeLimit(int limit) {
        return Math.min(Math.max(limit, 1), 100);
    }

}

record ClearTablesRequest(List<String> targets, String confirmation) {
}

record OfficialAtsPublishRequest(String catalogJson, String changeNote) {
}

record OfficialAtsRollbackRequest(String changeNote) {
}
