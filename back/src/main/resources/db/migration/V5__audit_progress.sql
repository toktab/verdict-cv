ALTER TABLE audits
    ADD COLUMN progress_stage VARCHAR(40) NOT NULL DEFAULT 'queued',
    ADD COLUMN progress_percent INT NOT NULL DEFAULT 0,
    ADD COLUMN progress_message VARCHAR(160) NOT NULL DEFAULT 'Queued for analysis.';
