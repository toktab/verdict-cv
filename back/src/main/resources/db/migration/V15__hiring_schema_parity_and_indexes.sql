ALTER TABLE hiring_candidates
    ADD COLUMN candidate_email VARCHAR(160) NULL AFTER name,
    ADD COLUMN memory_history_json LONGTEXT NULL AFTER memory;

UPDATE hiring_candidates
SET memory_history_json = '[]'
WHERE memory_history_json IS NULL
   OR memory_history_json = '';

ALTER TABLE hiring_candidates
    MODIFY COLUMN memory_history_json LONGTEXT NOT NULL,
    ADD KEY idx_hiring_candidates_email (candidate_email),
    ADD KEY idx_hiring_candidates_project_state (project_id, state);

ALTER TABLE project_invites
    ADD KEY idx_project_invites_project_email_status (project_id, invited_email, status);

ALTER TABLE app_messages
    ADD KEY idx_app_messages_recipient_read (recipient_email, read_at);
