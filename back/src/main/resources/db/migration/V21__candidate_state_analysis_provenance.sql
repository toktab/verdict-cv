ALTER TABLE hiring_candidates
    ADD COLUMN analysis_engine VARCHAR(180) NOT NULL DEFAULT 'legacy-candidate-policy',
    ADD COLUMN analysis_prompt_version VARCHAR(120) NOT NULL DEFAULT 'legacy',
    ADD COLUMN analysis_completed_at DATETIME(6) NULL,
    ADD COLUMN prompt_tokens INT NOT NULL DEFAULT 0,
    ADD COLUMN completion_tokens INT NOT NULL DEFAULT 0,
    ADD COLUMN total_tokens INT NOT NULL DEFAULT 0,
    ADD COLUMN estimated_cost_usd DECIMAL(14,6) NOT NULL DEFAULT 0.000000;

UPDATE hiring_candidates
SET analysis_completed_at = created_at
WHERE analysis_completed_at IS NULL;
