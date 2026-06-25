package dev.toktab.brainhack.api;

import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Connection;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
public class SystemController {
    private final DataSource dataSource;
    private final AuditLogService logService;

    public SystemController(DataSource dataSource, AuditLogService logService) {
        this.dataSource = dataSource;
        this.logService = logService;
    }

    @GetMapping("/health")
    public Map<String, Object> health(HttpServletRequest request) throws Exception {
        long started = System.currentTimeMillis();
        try (Connection connection = dataSource.getConnection()) {
            boolean valid = connection.isValid(2);
            String database = connection.getMetaData().getDatabaseProductName();
            logService.record("DB_HEALTH_CHECK", request, 200, System.currentTimeMillis() - started, "visitor", "database=" + database + "; valid=" + valid);
            return Map.of("status", "UP", "database", database, "valid", valid);
        }
    }
}
