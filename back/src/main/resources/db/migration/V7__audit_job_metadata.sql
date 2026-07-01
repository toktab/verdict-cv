ALTER TABLE audits
    ADD COLUMN job_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN queued_at TIMESTAMP NULL,
    ADD COLUMN started_at TIMESTAMP NULL,
    ADD COLUMN finished_at TIMESTAMP NULL,
    ADD COLUMN last_worker_heartbeat_at TIMESTAMP NULL;
