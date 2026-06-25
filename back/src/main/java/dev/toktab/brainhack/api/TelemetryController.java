package dev.toktab.brainhack.api;

import dev.toktab.brainhack.api.dto.TelemetryRequest;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/telemetry")
public class TelemetryController {
    private final AuditLogService logService;

    public TelemetryController(AuditLogService logService) {
        this.logService = logService;
    }

    @PostMapping
    public Map<String, String> record(@Valid @RequestBody TelemetryRequest request, HttpServletRequest httpRequest) {
        String detail = "action=" + request.action()
                + "; target=" + safe(request.target())
                + "; detail=" + safe(request.detail());
        logService.record("UI_ACTION", httpRequest, 200, 0, "visitor", detail);
        return Map.of("status", "logged");
    }

    private String safe(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("[\\r\\n\\t]", " ");
    }
}
