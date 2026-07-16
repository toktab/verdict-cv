ALTER TABLE hiring_candidates
    ADD COLUMN analysis_state VARCHAR(40) NOT NULL DEFAULT 'strict-war-ai',
    ADD COLUMN initialized_analysis_states_json LONGTEXT NULL;

UPDATE hiring_candidates
SET initialized_analysis_states_json = JSON_ARRAY(analysis_state)
WHERE initialized_analysis_states_json IS NULL
   OR initialized_analysis_states_json = '';

ALTER TABLE hiring_candidates
    MODIFY COLUMN initialized_analysis_states_json LONGTEXT NOT NULL;
