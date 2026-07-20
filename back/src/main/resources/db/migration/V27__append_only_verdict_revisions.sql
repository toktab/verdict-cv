CREATE TABLE verdict_revisions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    verdict_id BIGINT NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    actor_name VARCHAR(160) NOT NULL,
    patch_json LONGTEXT NOT NULL,
    reason LONGTEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_verdict_revisions_verdict
        FOREIGN KEY (verdict_id) REFERENCES verdicts(id) ON DELETE CASCADE
);

CREATE INDEX idx_verdict_revisions_verdict_created
    ON verdict_revisions(verdict_id, created_at);

