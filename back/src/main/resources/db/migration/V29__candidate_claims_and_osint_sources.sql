-- Normalized candidate claims table
-- Extracted from hiring_candidates.claims_json for relational access
CREATE TABLE candidate_claims (
    id BIGINT NOT NULL AUTO_INCREMENT,
    candidate_id BIGINT NOT NULL,
    claim_text TEXT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Unsupported',
    reason TEXT NULL,
    sentence_index INT NOT NULL DEFAULT 0,
    analysis_run_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_candidate_claims_candidate (candidate_id),
    KEY idx_candidate_claims_status (candidate_id, status),
    CONSTRAINT fk_cand_claims_candidate
        FOREIGN KEY (candidate_id) REFERENCES hiring_candidates(id) ON DELETE CASCADE,
    CONSTRAINT fk_cand_claims_run
        FOREIGN KEY (analysis_run_id) REFERENCES candidate_analysis_runs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Normalized candidate OSINT sources table
-- Extracted from hiring_candidates.osint_report_json for relational access
CREATE TABLE candidate_osint_sources (
    id BIGINT NOT NULL AUTO_INCREMENT,
    candidate_id BIGINT NOT NULL,
    source_type VARCHAR(40) NOT NULL,
    source_url TEXT NULL,
    finding VARCHAR(255) NULL,
    confidence INT NOT NULL DEFAULT 0,
    impact VARCHAR(80) NULL,
    tone VARCHAR(40) NULL,
    checked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_cand_osint_srcs_candidate (candidate_id),
    KEY idx_cand_osint_srcs_type (candidate_id, source_type),
    CONSTRAINT fk_cand_osint_srcs_candidate
        FOREIGN KEY (candidate_id) REFERENCES hiring_candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
