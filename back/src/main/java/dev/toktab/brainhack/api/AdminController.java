package dev.toktab.brainhack.api;

import dev.toktab.brainhack.admin.AdminSessionService;
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
import dev.toktab.brainhack.log.AppEventLog;
import dev.toktab.brainhack.log.AppEventLogRepository;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
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

    public AdminController(
            AdminSessionService adminSessionService,
            AuditService auditService,
            AuditMapper auditMapper,
            VerdictRepository verdictRepository,
            AppEventLogRepository logRepository,
            AuditLogService logService,
            UserAccountService userAccountService,
            UserMapper userMapper,
            AccountSettingsService accountSettingsService) {
        this.adminSessionService = adminSessionService;
        this.auditService = auditService;
        this.auditMapper = auditMapper;
        this.verdictRepository = verdictRepository;
        this.logRepository = logRepository;
        this.logService = logService;
        this.userAccountService = userAccountService;
        this.userMapper = userMapper;
        this.accountSettingsService = accountSettingsService;
    }

    @PostMapping("/login")
    public AdminLoginResponse login(@Valid @RequestBody AdminLoginRequest request, HttpServletRequest httpRequest) {
        String token = adminSessionService.login(request.username(), request.password());
        logService.record("ADMIN_LOGIN", httpRequest, 200, 0, request.username(), "admin logged in");
        return new AdminLoginResponse(token, adminSessionService.username());
    }

    @GetMapping("/audits")
    public List<AuditResponse> audits(@RequestParam(defaultValue = "0") int offset, @RequestParam(defaultValue = "20") int limit, @RequestParam(defaultValue = "") String search) {
        return auditService.history(search).stream()
                .skip(safeOffset(offset))
                .limit(safeLimit(limit))
                .map(auditMapper::toResponse)
                .toList();
    }

    @GetMapping("/audits/{id}")
    public AuditResponse audit(@PathVariable Long id) {
        return auditMapper.toResponse(auditService.get(id));
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
        return userAccountService.users(search).stream()
                .skip(safeOffset(offset))
                .limit(safeLimit(limit))
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

    @PatchMapping("/settings")
    public AdminSettingsResponse updateSettings(@RequestBody AdminSettingsRequest request) {
        boolean required = accountSettingsService.setRequireEmailVerification(request.requireEmailVerification());
        logService.recordSystem("ADMIN_UPDATE_SETTINGS", "requireEmailVerification=" + required);
        return new AdminSettingsResponse(required);
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
    public List<AppEventLog> logs(@RequestParam(defaultValue = "0") int offset, @RequestParam(defaultValue = "20") int limit, @RequestParam(defaultValue = "") String search) {
        String needle = search == null ? "" : search.trim().toLowerCase();
        return logRepository.findTop250ByDeletedAtIsNullOrderByCreatedAtDesc().stream()
                .filter(log -> needle.isBlank()
                        || contains(log.getEventType(), needle)
                        || contains(log.getMethod(), needle)
                        || contains(log.getPath(), needle)
                        || contains(log.getActor(), needle)
                        || contains(log.getIpAddress(), needle)
                        || contains(log.getRequestId(), needle)
                        || contains(log.getDetail(), needle))
                .skip(safeOffset(offset))
                .limit(safeLimit(limit))
                .toList();
    }

    @DeleteMapping("/logs/{id}")
    public void deleteLog(@PathVariable Long id) {
        AppEventLog log = logRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Log not found: " + id));
        log.setDeletedAt(Instant.now());
        logRepository.save(log);
    }

    private int safeOffset(int offset) {
        return Math.max(offset, 0);
    }

    private int safeLimit(int limit) {
        return Math.min(Math.max(limit, 1), 100);
    }

    private boolean contains(String value, String needle) {
        return value != null && value.toLowerCase().contains(needle);
    }
}
