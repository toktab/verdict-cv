ALTER TABLE audits
    ADD COLUMN project_id BIGINT NULL,
    ADD COLUMN candidate_id BIGINT NULL,
    ADD COLUMN candidate_analysis_run_id BIGINT NULL,
    ADD KEY idx_audits_project_created (project_id, created_at),
    ADD KEY idx_audits_candidate_created (candidate_id, created_at),
    ADD CONSTRAINT fk_audits_project FOREIGN KEY (project_id) REFERENCES hiring_projects (id),
    ADD CONSTRAINT fk_audits_candidate FOREIGN KEY (candidate_id) REFERENCES hiring_candidates (id),
    ADD CONSTRAINT fk_audits_candidate_analysis_run FOREIGN KEY (candidate_analysis_run_id) REFERENCES candidate_analysis_runs (id);
