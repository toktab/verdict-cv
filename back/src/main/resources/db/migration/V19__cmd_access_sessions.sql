ALTER TABLE user_sessions ADD COLUMN session_id VARCHAR(36) NULL;
ALTER TABLE user_sessions ADD COLUMN client_type VARCHAR(16) NOT NULL DEFAULT 'WEB';
ALTER TABLE user_sessions ADD COLUMN client_name VARCHAR(120) NOT NULL DEFAULT 'Website';

UPDATE user_sessions SET session_id = UUID() WHERE session_id IS NULL;

ALTER TABLE user_sessions MODIFY session_id VARCHAR(36) NOT NULL;
CREATE UNIQUE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_user_sessions_user_client_last_used ON user_sessions(user_id, client_type, last_used_at);
