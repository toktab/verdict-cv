CREATE TABLE realtime_tickets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_realtime_tickets_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_realtime_tickets_user
        FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_realtime_tickets_expiry ON realtime_tickets(expires_at);

