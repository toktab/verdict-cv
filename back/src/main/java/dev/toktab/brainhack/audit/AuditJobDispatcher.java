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
    private final String queue;

    public AuditJobDispatcher(
            RabbitTemplate rabbitTemplate,
            AuditLogService logService,
            @Value("${verdict.audit.rabbitmq.enabled}") boolean enabled,
            @Value("${verdict.audit.rabbitmq.exchange}") String exchange,
            @Value("${verdict.audit.rabbitmq.routing-key}") String routingKey,
            @Value("${verdict.audit.rabbitmq.queue}") String queue) {
        this.rabbitTemplate = rabbitTemplate;
        this.logService = logService;
        this.enabled = enabled;
        this.exchange = exchange;
        this.routingKey = routingKey;
        this.queue = queue;
    }

    public boolean dispatch(Long auditId) {
        if (!enabled) {
            return false;
        }
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, Map.of("auditId", auditId));
            QueueDepth depth = queueDepth();
            logService.recordSystem(
                    "AUDIT_JOB_DISPATCHED_RABBITMQ",
                    "auditId=" + auditId
                            + "; exchange=" + exchange
                            + "; routingKey=" + routingKey
                            + "; queue=" + queue
                            + "; queuedMessages=" + depth.messages()
                            + "; consumers=" + depth.consumers());
            return true;
        } catch (AmqpException exception) {
            logService.recordSystem(
                    "AUDIT_JOB_DISPATCH_FALLBACK",
                    "auditId=" + auditId
                            + "; queue=" + queue
                            + "; error=" + exception.getClass().getSimpleName()
                            + "; message=" + exception.getMessage());
            return false;
        }
    }

    private QueueDepth queueDepth() {
        try {
            return rabbitTemplate.execute(channel -> {
                var declaration = channel.queueDeclarePassive(queue);
                return new QueueDepth(declaration.getMessageCount(), declaration.getConsumerCount());
            });
        } catch (RuntimeException exception) {
            return new QueueDepth(-1, -1);
        }
    }

    private record QueueDepth(long messages, int consumers) {
    }
}
