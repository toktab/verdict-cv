package dev.toktab.brainhack.messaging;

import dev.toktab.brainhack.account.UserAccount;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class MessageFileLogger {
    private final Path logPath;

    public MessageFileLogger(@Value("${verdict.messages.log-file:logs/messages.txt}") String logFile) {
        this.logPath = Path.of(logFile);
    }

    public synchronized void sent(UserAccount actor, AppMessage message) {
        write(entry("MESSAGE SENT", actor, message));
    }

    public synchronized void updated(UserAccount actor, AppMessage message) {
        write(entry("MESSAGE UPDATED", actor, message));
    }

    private void write(String entry) {
        try {
            Path parent = logPath.toAbsolutePath().getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(logPath, entry, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not write message log", exception);
        }
    }

    private String entry(String event, UserAccount actor, AppMessage message) {
        return """
                --- %s ---
                logged_at=%s
                message_id=%s
                type=%s
                sent_at=%s
                from_user_id=%s
                from_username=%s
                from_email=%s
                from_name=%s
                to_email=%s
                subject=%s
                body=%s
                project_id=%s
                project_title=%s
                invite_token=%s
                invite_status=%s
                read=%s
                starred=%s
                reply_to_message_id=%s
                forwarded_from_message_id=%s

                """.formatted(
                event,
                Instant.now(),
                value(message.getId()),
                clean(message.getType()),
                value(message.getCreatedAt()),
                value(actor.getId()),
                clean(actor.getUsername()),
                clean(message.getSenderEmail()),
                clean(message.getSenderName()),
                clean(message.getRecipientEmail()),
                clean(message.getSubject()),
                clean(message.getBody()),
                value(message.getProjectId()),
                clean(message.getProjectTitle()),
                clean(message.getInviteToken()),
                clean(message.getInviteStatus()),
                value(message.isRead()),
                value(message.isStarred()),
                value(message.getReplyToMessageId()),
                value(message.getForwardedFromMessageId())
        );
    }

    private String clean(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.replace("\r", "\\r").replace("\n", "\\n");
    }

    private String value(Object value) {
        return value == null ? "" : clean(String.valueOf(value));
    }
}
