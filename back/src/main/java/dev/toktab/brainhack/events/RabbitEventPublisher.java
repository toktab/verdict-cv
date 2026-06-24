package dev.toktab.brainhack.events;

import dev.toktab.brainhack.log.AuditLogService;
import java.util.Map;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RabbitEventPublisher {
    private final RabbitTemplate rabbitTemplate;
    private final AuditLogService logService;
    private final boolean enabled;
    private final String exchange;

    public RabbitEventPublisher(
            RabbitTemplate rabbitTemplate,
            AuditLogService logService,
            @Value("${verdict.rabbitmq.enabled}") boolean enabled,
            @Value("${verdict.rabbitmq.exchange}") String exchange) {
        this.rabbitTemplate = rabbitTemplate;
        this.logService = logService;
        this.enabled = enabled;
        this.exchange = exchange;
    }

    public void publish(String routingKey, Map<String, Object> payload) {
        if (!enabled) {
            return;
        }
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, payload);
        } catch (AmqpException exception) {
            logService.recordSystem("RABBITMQ_PUBLISH_FAILED", exception.getMessage());
        }
    }
}
