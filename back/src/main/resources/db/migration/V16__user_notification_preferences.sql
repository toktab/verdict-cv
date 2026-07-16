ALTER TABLE user_accounts
    ADD COLUMN message_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN message_notifications_muted_until DATETIME(6) NULL;
