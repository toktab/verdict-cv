package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.log.AuditLogService;
import java.util.Map;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AuditJobDispatcher {
    private final RabbitTemplate rabbitTemplate;
    private final AuditLogService logService;
    private final boolean enabled;
    private final String exchange;
    private final String routingKey;

    public AuditJobDispatcher(
            RabbitTemplate rabbitTemplate,
            AuditLogService logService,
            @Value("${verdict.audit.rabbitmq.enabled}") boolean enabled,
            @Value("${verdict.audit.rabbitmq.exchange}") String exchange,
            @Value("${verdict.audit.rabbitmq.routing-key}") String routingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.logService = logService;
        this.enabled = enabled;
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    public boolean dispatch(Long auditId) {
        if (!enabled) {
            return false;
        }
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, Map.of("auditId", auditId));
            logService.recordSystem("AUDIT_JOB_DISPATCHED_RABBITMQ", "auditId=" + auditId);
            return true;
        } catch (AmqpException exception) {
            logService.recordSystem("AUDIT_JOB_DISPATCH_FALLBACK", exception.getMessage());
            return false;
        }
    }
}
