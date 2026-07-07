CREATE TABLE project_settings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    settings_json LONGTEXT NOT NULL,
    updated_by_id BIGINT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_project_settings_project (project_id),
    CONSTRAINT fk_project_settings_project FOREIGN KEY (project_id) REFERENCES hiring_projects (id),
    CONSTRAINT fk_project_settings_updated_by FOREIGN KEY (updated_by_id) REFERENCES user_accounts (id)
);

CREATE TABLE project_activity_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    actor_id BIGINT NULL,
    type VARCHAR(80) NOT NULL,
    action VARCHAR(220) NOT NULL,
    actor_email VARCHAR(160) NOT NULL,
    actor_name VARCHAR(160) NOT NULL,
    target_email VARCHAR(160) NOT NULL,
    target_name VARCHAR(160) NOT NULL,
    candidate_id BIGINT NULL,
    candidate_name VARCHAR(160) NOT NULL,
    project_title VARCHAR(180) NOT NULL,
    severity VARCHAR(40) NOT NULL,
    detail LONGTEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_project_activity_project_created (project_id, created_at),
    CONSTRAINT fk_project_activity_project FOREIGN KEY (project_id) REFERENCES hiring_projects (id),
    CONSTRAINT fk_project_activity_actor FOREIGN KEY (actor_id) REFERENCES user_accounts (id)
);

CREATE TABLE project_ats_templates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    owner_id BIGINT NOT NULL,
    template_key VARCHAR(120) NOT NULL,
    name VARCHAR(180) NOT NULL,
    visibility VARCHAR(40) NOT NULL,
    template_json LONGTEXT NOT NULL,
    verified_default BIT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_project_ats_project_updated (project_id, updated_at),
    KEY idx_project_ats_owner (owner_id),
    CONSTRAINT fk_project_ats_project FOREIGN KEY (project_id) REFERENCES hiring_projects (id),
    CONSTRAINT fk_project_ats_owner FOREIGN KEY (owner_id) REFERENCES user_accounts (id)
);

CREATE TABLE project_member_permissions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    member_email VARCHAR(160) NOT NULL,
    role VARCHAR(80) NOT NULL,
    permissions_json LONGTEXT NOT NULL,
    updated_by_id BIGINT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_project_member_permissions (project_id, member_email),
    CONSTRAINT fk_project_member_permissions_project FOREIGN KEY (project_id) REFERENCES hiring_projects (id),
    CONSTRAINT fk_project_member_permissions_updated_by FOREIGN KEY (updated_by_id) REFERENCES user_accounts (id)
);
