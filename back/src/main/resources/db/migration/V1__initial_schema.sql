CREATE TABLE user_accounts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    username VARCHAR(80) NOT NULL,
    email VARCHAR(160) NOT NULL,
    country VARCHAR(120) NOT NULL,
    address VARCHAR(220) NOT NULL,
    organization VARCHAR(80) NOT NULL,
    role VARCHAR(80) NOT NULL,
    account_role VARCHAR(80) NOT NULL,
    password_hash VARCHAR(120) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    last_login_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_accounts_username (username),
    UNIQUE KEY uk_user_accounts_email (email),
    KEY idx_user_accounts_username (username),
    KEY idx_user_accounts_email (email),
    KEY idx_user_accounts_created_at (created_at)
);

CREATE TABLE user_sessions (
    token VARCHAR(96) NOT NULL,
    user_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    PRIMARY KEY (token),
    KEY idx_user_sessions_user_id (user_id),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES user_accounts (id)
);

CREATE TABLE app_settings (
    setting_key VARCHAR(80) NOT NULL,
    setting_value VARCHAR(220) NOT NULL,
    PRIMARY KEY (setting_key)
);

CREATE TABLE audits (
    id BIGINT NOT NULL AUTO_INCREMENT,
    claim_title VARCHAR(160) NOT NULL,
    evidence_title VARCHAR(160) NOT NULL,
    claim_text LONGTEXT NOT NULL,
    evidence_text LONGTEXT NOT NULL,
    credibility_score INT NOT NULL,
    supported_count INT NOT NULL,
    stretched_count INT NOT NULL,
    unsupported_count INT NOT NULL,
    not_claim_count INT NOT NULL,
    gap_count INT NOT NULL,
    claim_fingerprint VARCHAR(64) NOT NULL,
    evidence_fingerprint VARCHAR(64) NOT NULL,
    processing_millis BIGINT NOT NULL,
    engine VARCHAR(40) NOT NULL,
    analyzer_version VARCHAR(80) NULL,
    prompt_version VARCHAR(80) NULL,
    status VARCHAR(16) NULL,
    template_id VARCHAR(80) NULL,
    template_name VARCHAR(120) NULL,
    template_description VARCHAR(500) NULL,
    template_instructions TEXT NULL,
    template_mark_unimportant TEXT NULL,
    check_state_id VARCHAR(80) NULL,
    check_state_name VARCHAR(120) NULL,
    check_state_description VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    owner_id BIGINT NULL,
    PRIMARY KEY (id),
    KEY idx_audits_created_at (created_at),
    KEY idx_audits_owner_created_at (owner_id, created_at),
    KEY idx_audits_owner_deleted_created (owner_id, deleted_at, created_at),
    CONSTRAINT fk_audits_owner FOREIGN KEY (owner_id) REFERENCES user_accounts (id)
);

CREATE TABLE verdicts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    audit_id BIGINT NOT NULL,
    sentence_index INT NOT NULL,
    sentence TEXT NOT NULL,
    status VARCHAR(24) NOT NULL,
    confidence VARCHAR(16) NOT NULL,
    reason_category VARCHAR(60) NOT NULL,
    explanation TEXT NOT NULL,
    evidence_pointer TEXT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_verdicts_audit_id (audit_id),
    CONSTRAINT fk_verdicts_audit FOREIGN KEY (audit_id) REFERENCES audits (id)
);

CREATE TABLE audit_templates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    mode VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL,
    instructions TEXT NOT NULL,
    mark_unimportant TEXT NOT NULL,
    shared BOOLEAN NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_audit_templates_owner_mode (owner_id, mode),
    KEY idx_audit_templates_created_at (created_at),
    CONSTRAINT fk_audit_templates_owner FOREIGN KEY (owner_id) REFERENCES user_accounts (id)
);

CREATE TABLE hiring_projects (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    title VARCHAR(180) NOT NULL,
    department VARCHAR(120) NOT NULL,
    location VARCHAR(120) NOT NULL,
    description LONGTEXT NOT NULL,
    requirements_text LONGTEXT NOT NULL,
    state VARCHAR(80) NOT NULL,
    status VARCHAR(80) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_hiring_projects_owner (owner_id),
    KEY idx_hiring_projects_created_at (created_at),
    CONSTRAINT fk_hiring_projects_owner FOREIGN KEY (owner_id) REFERENCES user_accounts (id)
);

CREATE TABLE hiring_candidates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    role VARCHAR(160) NOT NULL,
    cv_text LONGTEXT NOT NULL,
    resume_filename VARCHAR(220) NOT NULL,
    score INT NOT NULL,
    match_score INT NOT NULL,
    risk VARCHAR(40) NOT NULL,
    state VARCHAR(80) NOT NULL,
    osint VARCHAR(80) NOT NULL,
    memory VARCHAR(120) NOT NULL,
    flags INT NOT NULL,
    supported INT NOT NULL,
    stretched INT NOT NULL,
    unsupported INT NOT NULL,
    summary LONGTEXT NOT NULL,
    claims_json LONGTEXT NOT NULL,
    audit_phrase_matches_json LONGTEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_hiring_candidates_project (project_id),
    KEY idx_hiring_candidates_created_at (created_at),
    CONSTRAINT fk_hiring_candidates_project FOREIGN KEY (project_id) REFERENCES hiring_projects (id)
);

CREATE TABLE app_event_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    sequence INT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    request_id VARCHAR(80) NULL,
    ip_address VARCHAR(45) NOT NULL,
    method VARCHAR(12) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code INT NOT NULL,
    duration_millis BIGINT NOT NULL,
    actor VARCHAR(120) NOT NULL,
    detail TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_app_event_logs_created_at (created_at),
    KEY idx_app_event_logs_request_id (request_id),
    KEY idx_app_event_logs_deleted_created (deleted_at, created_at)
);
