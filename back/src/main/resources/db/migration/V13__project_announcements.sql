CREATE TABLE project_announcements (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    body LONGTEXT NOT NULL,
    mentions_json TEXT NOT NULL,
    pinned BIT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_project_announcement_project_created (project_id, created_at),
    KEY idx_project_announcement_project_pinned (project_id, pinned),
    CONSTRAINT fk_project_announcement_project FOREIGN KEY (project_id) REFERENCES hiring_projects (id),
    CONSTRAINT fk_project_announcement_author FOREIGN KEY (author_id) REFERENCES user_accounts (id)
);
