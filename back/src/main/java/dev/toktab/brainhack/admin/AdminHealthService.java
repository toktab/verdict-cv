package dev.toktab.brainhack.admin;

import dev.toktab.brainhack.audit.AuditRepository;
import dev.toktab.brainhack.audit.AuditStatus;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AdminHealthService {
    private final JdbcTemplate jdbcTemplate;
    private final AuditRepository auditRepository;
    private final RabbitTemplate rabbitTemplate;
    private final String llmApiKey;
    private final String llmModel;
    private final String llmUrl;
    private final int llmTimeoutSeconds;
    private final int llmMaxAttempts;
    private final boolean rabbitEventsEnabled;
    private final boolean rabbitAuditEnabled;
    private final String rabbitHost;
    private final int rabbitPort;
    private final String auditQueue;
    private final String buildHash;
    private final String buildVersion;

    public AdminHealthService(
            JdbcTemplate jdbcTemplate,
            AuditRepository auditRepository,
            RabbitTemplate rabbitTemplate,
            @Value("${verdict.llm.api-key:}") String llmApiKey,
            @Value("${verdict.llm.model:gpt-4o-mini}") String llmModel,
            @Value("${verdict.llm.url:https://api.openai.com/v1/chat/completions}") String llmUrl,
            @Value("${verdict.llm.timeout-seconds:20}") int llmTimeoutSeconds,
            @Value("${verdict.llm.max-attempts:3}") int llmMaxAttempts,
            @Value("${verdict.rabbitmq.enabled:false}") boolean rabbitEventsEnabled,
            @Value("${verdict.audit.rabbitmq.enabled:false}") boolean rabbitAuditEnabled,
            @Value("${spring.rabbitmq.host:localhost}") String rabbitHost,
            @Value("${spring.rabbitmq.port:5672}") int rabbitPort,
            @Value("${verdict.audit.rabbitmq.queue:verdict.audit.jobs}") String auditQueue,
            @Value("${VERDICT_BUILD_HASH:${GIT_COMMIT:dev}}") String buildHash,
            @Value("${VERDICT_BUILD_VERSION:${APP_VERSION:0.0.1-SNAPSHOT}}") String buildVersion) {
        this.jdbcTemplate = jdbcTemplate;
        this.auditRepository = auditRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.llmApiKey = llmApiKey;
        this.llmModel = llmModel;
        this.llmUrl = llmUrl;
        this.llmTimeoutSeconds = llmTimeoutSeconds;
        this.llmMaxAttempts = llmMaxAttempts;
        this.rabbitEventsEnabled = rabbitEventsEnabled;
        this.rabbitAuditEnabled = rabbitAuditEnabled;
        this.rabbitHost = rabbitHost;
        this.rabbitPort = rabbitPort;
        this.auditQueue = auditQueue;
        this.buildHash = buildHash;
        this.buildVersion = buildVersion;
    }

    public AdminHealthResponse health() {
        DbHealth db = database();
        RabbitHealth rabbitmq = rabbit();
        AuditHealth audits = auditHealth(db.ok());
        String overallStatus = !db.ok() || (rabbitmq.enabled() && !rabbitmq.connected()) ? "DOWN"
                : audits.failureRate() >= 10 || audits.oldestRunningSeconds() >= 300 ? "DEGRADED"
                : "HEALTHY";
        return new AdminHealthResponse(
                Instant.now(),
                overallStatus,
                buildHash,
                buildVersion,
                db,
                llm(),
                rabbitmq,
                runtime(),
                audits
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

    private LlmHealth llm() {
        boolean configured = !llmApiKey.isBlank();
        return new LlmHealth(
                configured,
                configured ? "ready" : "local-fallback",
                llmModel,
                endpointHost(llmUrl),
                llmTimeoutSeconds,
                llmMaxAttempts
        );
    }

    private RabbitHealth rabbit() {
        boolean enabled = rabbitEventsEnabled || rabbitAuditEnabled;
        if (!enabled) {
            return new RabbitHealth(false, false, rabbitEventsEnabled, rabbitAuditEnabled, rabbitHost, rabbitPort,
                    auditQueue, 0, 0, "disabled");
        }
        try {
            return rabbitTemplate.execute(channel -> {
                if (!rabbitAuditEnabled) {
                    return new RabbitHealth(true, channel.isOpen(), rabbitEventsEnabled, false, rabbitHost, rabbitPort,
                            auditQueue, 0, 0, channel.isOpen() ? "connected" : "closed");
                }
                var queue = channel.queueDeclarePassive(auditQueue);
                return new RabbitHealth(true, true, rabbitEventsEnabled, rabbitAuditEnabled, rabbitHost, rabbitPort,
                        auditQueue, queue.getMessageCount(), queue.getConsumerCount(), "connected");
            });
        } catch (Exception exception) {
            return new RabbitHealth(true, false, rabbitEventsEnabled, rabbitAuditEnabled, rabbitHost, rabbitPort,
                    auditQueue, 0, 0, exception.getClass().getSimpleName());
        }
    }

    private AuditHealth auditHealth(boolean databaseAvailable) {
        if (!databaseAvailable) {
            return AuditHealth.unavailable("database unavailable");
        }
        try {
            long total = auditRepository.countByDeletedAtIsNull();
            long failed = auditRepository.countByStatusAndDeletedAtIsNull(AuditStatus.FAILED);
            long running = auditRepository.countByStatusAndDeletedAtIsNull(AuditStatus.RUNNING);
            long cancelled = auditRepository.countByStatusAndDeletedAtIsNull(AuditStatus.CANCELLED);
            long completed = auditRepository.countByStatusAndDeletedAtIsNull(AuditStatus.COMPLETED);
            long fallback = auditRepository.countFallbackAudits();
            double averageProcessingMillis = Math.round(auditRepository.averageCompletedProcessingMillis());
            Instant oldestRunningAt = auditRepository.oldestRunningStartedAt();
            long oldestRunningSeconds = oldestRunningAt == null ? 0 : Math.max(0, Duration.between(oldestRunningAt, Instant.now()).toSeconds());
            double failureRate = total == 0 ? 0.0 : Math.round((failed * 10000.0) / total) / 100.0;
            double fallbackRate = total == 0 ? 0.0 : Math.round((fallback * 10000.0) / total) / 100.0;
            return new AuditHealth(true, "ok", total, completed, failed, running, cancelled, failureRate,
                    fallback, fallbackRate, averageProcessingMillis, oldestRunningSeconds);
        } catch (Exception exception) {
            return AuditHealth.unavailable(exception.getClass().getSimpleName());
        }
    }

    private RuntimeHealth runtime() {
        Runtime runtime = Runtime.getRuntime();
        long heapUsedBytes = runtime.totalMemory() - runtime.freeMemory();
        long heapMaxBytes = runtime.maxMemory();
        File disk = new File(".");
        return new RuntimeHealth(
                ManagementFactory.getRuntimeMXBean().getUptime() / 1000,
                heapUsedBytes / (1024 * 1024),
                heapMaxBytes / (1024 * 1024),
                disk.getUsableSpace() / (1024 * 1024),
                runtime.availableProcessors(),
                System.getProperty("java.version", "unknown")
        );
    }

    private String endpointHost(String value) {
        try {
            URI uri = URI.create(value);
            return uri.getHost() == null ? "custom-endpoint" : uri.getHost();
        } catch (Exception ignored) {
            return "invalid-endpoint";
        }
    }

    public record AdminHealthResponse(
            Instant checkedAt,
            String overallStatus,
            String buildHash,
            String buildVersion,
            DbHealth db,
            LlmHealth llm,
            RabbitHealth rabbitmq,
            RuntimeHealth runtime,
            AuditHealth audits
    ) {
    }

    public record DbHealth(boolean ok, long latencyMillis, String status) {
    }

    public record LlmHealth(boolean configured, String status, String model, String endpointHost, int timeoutSeconds, int maxAttempts) {
    }

    public record RabbitHealth(boolean enabled, boolean connected, boolean eventsEnabled, boolean auditQueueEnabled,
                               String host, int port, String queue, long queuedMessages, long consumers, String status) {
    }

    public record RuntimeHealth(long uptimeSeconds, long heapUsedMb, long heapMaxMb, long diskFreeMb, int processors, String javaVersion) {
    }

    public record AuditHealth(boolean available, String status, long total, long completed, long failed, long running,
                              long cancelled, double failureRate, long fallback, double fallbackRate,
                              double averageProcessingMillis, long oldestRunningSeconds) {
        static AuditHealth unavailable(String status) {
            return new AuditHealth(false, status, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
    }
}
