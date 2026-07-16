CREATE TABLE official_ats_template_versions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    version_number INT NOT NULL,
    catalog_json LONGTEXT NOT NULL,
    change_note VARCHAR(500) NOT NULL,
    created_by VARCHAR(120) NOT NULL,
    active BIT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_official_ats_version (version_number),
    KEY idx_official_ats_active (active),
    KEY idx_official_ats_created (created_at)
);
