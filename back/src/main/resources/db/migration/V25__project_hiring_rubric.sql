ALTER TABLE hiring_projects
    ADD COLUMN rubric_json LONGTEXT NULL AFTER requirements_text;

