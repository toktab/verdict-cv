CREATE TABLE cli_pairing_codes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code_hash VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at DATETIME(6) NULL,
    requested_from_ip VARCHAR(45) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_cli_pairing_codes_hash UNIQUE (code_hash),
    CONSTRAINT fk_cli_pairing_codes_user FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_cli_pairing_codes_user_active ON cli_pairing_codes(user_id, used_at, expires_at);
