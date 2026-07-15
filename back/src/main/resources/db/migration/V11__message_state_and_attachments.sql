ALTER TABLE app_messages
    ADD COLUMN reply_to_message_id BIGINT NULL,
    ADD COLUMN forwarded_from_message_id BIGINT NULL,
    ADD COLUMN read_at DATETIME(6) NULL,
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN candidate_attachments_json LONGTEXT NULL;

CREATE INDEX idx_app_messages_reply_to ON app_messages (reply_to_message_id);
CREATE INDEX idx_app_messages_forwarded_from ON app_messages (forwarded_from_message_id);
