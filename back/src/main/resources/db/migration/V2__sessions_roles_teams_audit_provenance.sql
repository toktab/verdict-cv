ALTER TABLE user_sessions
    ADD COLUMN refresh_token VARCHAR(96) NULL,
    ADD COLUMN refresh_expires_at DATETIME(6) NULL,
    ADD COLUMN user_agent VARCHAR(220) NULL,
    ADD COLUMN ip_address VARCHAR(45) NULL,
    ADD COLUMN last_used_at DATETIME(6) NULL,
    ADD COLUMN revocation_reason VARCHAR(120) NULL,
    ADD COLUMN revoked_at DATETIME(6) NULL;

UPDATE user_sessions
SET refresh_token = token,
    refresh_expires_at = expires_at,
    last_used_at = created_at
WHERE refresh_token IS NULL;

ALTER TABLE user_sessions
    MODIFY refresh_token VARCHAR(96) NOT NULL,
    MODIFY refresh_expires_at DATETIME(6) NOT NULL;

ALTER TABLE user_sessions
    ADD CONSTRAINT uk_user_sessions_refresh_token UNIQUE (refresh_token);

UPDATE user_accounts
SET account_role = 'USER'
WHERE account_role IS NULL
   OR account_role = ''
   OR UPPER(REPLACE(REPLACE(account_role, '-', '_'), ' ', '_')) NOT IN ('USER', 'REVIEWER', 'ORGANIZATION_ADMIN', 'SYSTEM_ADMIN');

CREATE TABLE organizations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(160) NOT NULL,
    owner_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_organizations_owner (owner_id),
    KEY idx_organizations_created_at (created_at),
    CONSTRAINT fk_organizations_owner FOREIGN KEY (owner_id) REFERENCES user_accounts (id)
);

CREATE TABLE team_memberships (
    id BIGINT NOT NULL AUTO_INCREMENT,
    organization_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(80) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_team_memberships_org_user (organization_id, user_id),
    KEY idx_team_memberships_user (user_id),
    CONSTRAINT fk_team_memberships_organization FOREIGN KEY (organization_id) REFERENCES organizations (id),
    CONSTRAINT fk_team_memberships_user FOREIGN KEY (user_id) REFERENCES user_accounts (id)
);

ALTER TABLE hiring_projects
    ADD COLUMN organization_id BIGINT NULL,
    ADD KEY idx_hiring_projects_organization (organization_id),
    ADD CONSTRAINT fk_hiring_projects_organization FOREIGN KEY (organization_id) REFERENCES organizations (id);

CREATE TABLE project_invites (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    invited_by_id BIGINT NOT NULL,
    invited_email VARCHAR(160) NOT NULL,
    role VARCHAR(80) NOT NULL,
    token VARCHAR(96) NOT NULL,
    status VARCHAR(40) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    accepted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_project_invites_token (token),
    KEY idx_project_invites_project (project_id),
    KEY idx_project_invites_token (token),
    CONSTRAINT fk_project_invites_project FOREIGN KEY (project_id) REFERENCES hiring_projects (id),
    CONSTRAINT fk_project_invites_invited_by FOREIGN KEY (invited_by_id) REFERENCES user_accounts (id)
);

CREATE TABLE candidate_review_notes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    candidate_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    type VARCHAR(40) NOT NULL,
    decision VARCHAR(80) NOT NULL,
    body LONGTEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_candidate_review_notes_candidate (candidate_id, created_at),
    CONSTRAINT fk_candidate_review_notes_candidate FOREIGN KEY (candidate_id) REFERENCES hiring_candidates (id),
    CONSTRAINT fk_candidate_review_notes_author FOREIGN KEY (author_id) REFERENCES user_accounts (id)
);

ALTER TABLE verdicts
    ADD COLUMN engine VARCHAR(80) NULL,
    ADD COLUMN analyzer_version VARCHAR(80) NULL,
    ADD COLUMN prompt_version VARCHAR(80) NULL,
    ADD COLUMN manual_override_reason VARCHAR(120) NULL;

CREATE TABLE verdict_overrides (
    id BIGINT NOT NULL AUTO_INCREMENT,
    verdict_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    previous_status VARCHAR(24) NOT NULL,
    new_status VARCHAR(24) NOT NULL,
    reason LONGTEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_verdict_overrides_verdict (verdict_id, created_at),
    CONSTRAINT fk_verdict_overrides_verdict FOREIGN KEY (verdict_id) REFERENCES verdicts (id),
    CONSTRAINT fk_verdict_overrides_author FOREIGN KEY (author_id) REFERENCES user_accounts (id)
);

CREATE TABLE audit_snapshots (
    id BIGINT NOT NULL AUTO_INCREMENT,
    audit_id BIGINT NOT NULL,
    owner_id BIGINT NULL,
    payload_json LONGTEXT NOT NULL,
    snapshot_fingerprint VARCHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_audit_snapshots_audit (audit_id, created_at),
    CONSTRAINT fk_audit_snapshots_audit FOREIGN KEY (audit_id) REFERENCES audits (id),
    CONSTRAINT fk_audit_snapshots_owner FOREIGN KEY (owner_id) REFERENCES user_accounts (id)
);
