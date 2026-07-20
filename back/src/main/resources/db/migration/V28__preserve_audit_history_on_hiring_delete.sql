ALTER TABLE audits
    DROP FOREIGN KEY fk_audits_project,
    DROP FOREIGN KEY fk_audits_candidate,
    DROP FOREIGN KEY fk_audits_candidate_analysis_run;

ALTER TABLE audits
    ADD CONSTRAINT fk_audits_project
        FOREIGN KEY (project_id) REFERENCES hiring_projects (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_audits_candidate
        FOREIGN KEY (candidate_id) REFERENCES hiring_candidates (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_audits_candidate_analysis_run
        FOREIGN KEY (candidate_analysis_run_id) REFERENCES candidate_analysis_runs (id) ON DELETE SET NULL;
