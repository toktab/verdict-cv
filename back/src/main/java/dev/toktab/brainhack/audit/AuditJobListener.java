package dev.toktab.brainhack.audit;

import java.util.Map;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class AuditJobListener {
    private final AuditService auditService;

    public AuditJobListener(AuditService auditService) {
        this.auditService = auditService;
    }

    @RabbitListener(queues = "${verdict.audit.rabbitmq.queue}", autoStartup = "${verdict.audit.rabbitmq.enabled:false}")
    public void receive(Map<String, Object> message) {
        Object rawAuditId = message.get("auditId");
        if (rawAuditId instanceof Number number) {
            auditService.completeQueued(number.longValue());
            return;
        }
        auditService.completeQueued(Long.parseLong(String.valueOf(rawAuditId)));
    }
}
