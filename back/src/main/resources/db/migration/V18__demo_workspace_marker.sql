ALTER TABLE hiring_projects
    ADD COLUMN demo_data BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_hiring_projects_demo_data ON hiring_projects (demo_data);

ALTER TABLE audits
    ADD COLUMN demo_data BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_audits_demo_data ON audits (demo_data);
