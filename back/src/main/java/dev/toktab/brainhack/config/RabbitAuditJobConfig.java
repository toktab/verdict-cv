package dev.toktab.brainhack.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitAuditJobConfig {
    @Bean
    Queue auditJobQueue(@Value("${verdict.audit.rabbitmq.queue}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    TopicExchange auditJobExchange(@Value("${verdict.audit.rabbitmq.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    Binding auditJobBinding(Queue auditJobQueue, TopicExchange auditJobExchange, @Value("${verdict.audit.rabbitmq.routing-key}") String routingKey) {
        return BindingBuilder.bind(auditJobQueue).to(auditJobExchange).with(routingKey);
    }
}
