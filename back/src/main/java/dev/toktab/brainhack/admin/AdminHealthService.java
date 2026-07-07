package dev.toktab.brainhack.admin;

import dev.toktab.brainhack.audit.AuditRepository;
import dev.toktab.brainhack.audit.AuditStatus;
import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AdminHealthService {
    private final JdbcTemplate jdbcTemplate;
    private final AuditRepository auditRepository;
    private final String llmApiKey;
    private final String llmModel;
    private final boolean rabbitEventsEnabled;
    private final boolean rabbitAuditEnabled;
    private final String rabbitHost;
    private final String auditQueue;
    private final String buildHash;

    public AdminHealthService(
            JdbcTemplate jdbcTemplate,
            AuditRepository auditRepository,
            @Value("${verdict.llm.api-key:}") String llmApiKey,
            @Value("${verdict.llm.model:gpt-4o-mini}") String llmModel,
            @Value("${verdict.rabbitmq.enabled:false}") boolean rabbitEventsEnabled,
            @Value("${verdict.audit.rabbitmq.enabled:false}") boolean rabbitAuditEnabled,
            @Value("${spring.rabbitmq.host:localhost}") String rabbitHost,
            @Value("${verdict.audit.rabbitmq.queue:verdict.audit.jobs}") String auditQueue,
            @Value("${VERDICT_BUILD_HASH:${GIT_COMMIT:dev}}") String buildHash) {
        this.jdbcTemplate = jdbcTemplate;
        this.auditRepository = auditRepository;
        this.llmApiKey = llmApiKey;
        this.llmModel = llmModel;
        this.rabbitEventsEnabled = rabbitEventsEnabled;
        this.rabbitAuditEnabled = rabbitAuditEnabled;
        this.rabbitHost = rabbitHost;
        this.auditQueue = auditQueue;
        this.buildHash = buildHash;
    }

    public AdminHealthResponse health() {
        DbHealth db = database();
        long totalAudits = auditRepository.countByDeletedAtIsNull();
        long failedAudits = auditRepository.countByStatusAndDeletedAtIsNull(AuditStatus.FAILED);
        long runningAudits = auditRepository.countByStatusAndDeletedAtIsNull(AuditStatus.RUNNING);
        long cancelledAudits = auditRepository.countByStatusAndDeletedAtIsNull(AuditStatus.CANCELLED);
        double failureRate = totalAudits == 0 ? 0.0 : Math.round((failedAudits * 10000.0) / totalAudits) / 100.0;
        return new AdminHealthResponse(
                Instant.now(),
                buildHash,
                db,
                new LlmHealth(!llmApiKey.isBlank(), llmModel, llmApiKey.isBlank() ? "fallback-local" : "configured"),
                new RabbitHealth(rabbitEventsEnabled, rabbitAuditEnabled, rabbitHost, auditQueue, rabbitAuditEnabled ? "rabbit-backed" : "local-worker"),
                new AuditHealth(totalAudits, failedAudits, runningAudits, cancelledAudits, failureRate)
        );
    }

    private DbHealth database() {
        long started = System.nanoTime();
        try {
            Integer probe = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            long millis = Math.max(1, (System.nanoTime() - started) / 1_000_000);
            return new DbHealth(probe != null && probe == 1, millis, "ok");
        } catch (Exception exception) {
            long millis = Math.max(1, (System.nanoTime() - started) / 1_000_000);
            return new DbHealth(false, millis, exception.getClass().getSimpleName());
        }
    }

    public record AdminHealthResponse(
            Instant checkedAt,
            String buildHash,
            DbHealth db,
            LlmHealth llm,
            RabbitHealth rabbitmq,
            AuditHealth audits
    ) {
    }

    public record DbHealth(boolean ok, long latencyMillis, String status) {
    }

    public record LlmHealth(boolean configured, String model, String mode) {
    }

    public record RabbitHealth(boolean eventsEnabled, boolean auditQueueEnabled, String host, String queue, String status) {
    }

    public record AuditHealth(long total, long failed, long running, long cancelled, double failureRate) {
    }
}
