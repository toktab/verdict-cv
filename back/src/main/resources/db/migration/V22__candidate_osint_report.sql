ALTER TABLE hiring_candidates
    ADD COLUMN osint_report_json LONGTEXT NULL,
    ADD COLUMN osint_checked_at DATETIME(6) NULL;

UPDATE hiring_candidates
SET osint_report_json = ''
WHERE osint_report_json IS NULL;

ALTER TABLE hiring_candidates
    MODIFY osint_report_json LONGTEXT NOT NULL;
