# VERDICT Product Scope

## Mission

VERDICT helps hiring teams make evidence-based decisions by automatically verifying candidate CV claims against job requirements and public sources.

## Current Features

### Authentication & User Management
- User registration and login with BCrypt password hashing
- JWT-based stateless sessions (access + refresh tokens)
- CLI pairing via one-time passwordless codes
- Admin panel with user management and system settings
- Notification preferences (message muting)

### Project Management
- Create and manage hiring projects
- Organization-level project grouping
- Project settings and analysis configuration
- Activity logging per project
- Soft delete with restore support

### Candidate Management
- Add candidates via CV text paste or file upload (PDF, DOCX, TXT)
- Automatic CV text extraction with format support
- Duplicate detection across projects (candidate memory)
- Soft delete with audit trail

### Analysis Engine (4 States)
- **Light** — fast local heuristic pass, no AI calls
- **WAR** — default deterministic analysis, cross-checks claims against evidence
- **Person** — LLM-backed candidate-focused review with local fallback
- **WAR+AI** — combined deterministic + AI, stricter verdict wins

### Scoring System
- 0-100 composite recommendation score
- ATS keyword coverage percentage
- Evidence score (public source verification)
- GitHub match score (repository signals relevant to role)
- Reviewer consensus score (team votes normalized)
- Risk classification (Low / Medium / High)
- Score level explanation (1-10 scale)

### Workflow & Collaboration
- Candidate status pipeline: Unreviewed → OnCheck → OnInterview → Hired → Closed
- Reviewer voting (upvote with 0.5-5 score, downvote, star)
- Reviewer notes with decision tracking
- Role-based permissions per project
- Activity log / audit trail

### Evidence & OSINT
- Public source discovery from CV text (GitHub, LinkedIn, portfolio links)
- GitHub profile and repository analysis
- Technology-to-job matching via GitHub evidence
- Source quality indicators and trust levels
- Consent gate for external source checks

### Communication
- Internal messaging between team members
- Message templates and team-wide announcements
- Read/unread tracking with delivery states
- Invite acceptance via message tokens

### Audit Engine
- Claim vs. evidence analysis with configurable templates
- Multi-format export (PDF, CSV, DOC, TXT)
- LLM usage tracking (tokens, cost, model)
- Failure states with specific error messages
- Verdict revision history

### Admin Tools
- User management (create, edit, soft-delete)
- System settings (email verification requirement)
- Official ATS template version management
- Table clearing with confirmation guardrails
- Health dashboard (DB, LLM, RabbitMQ status)
- Activity log with search and filtering

## In Development

- Normalized candidate_claims and candidate_osint_sources tables
- CI pipeline: run backend tests before Docker build, add lint/typecheck/e2e
- Human review labels on automated scores
- Property name consistency (rabbit.enabled → rabbitmq.enabled)

## Out of Scope (Future)

- Full OSINT pipeline (Python-based tools, automated source adapters)
- Candidate comparison view (2-4 candidates side by side)
- Interview pack generation
- Sentiment and behavioral analysis
- CRM integration
- Public API for third-party integrations
