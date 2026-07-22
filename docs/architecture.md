# VERDICT Architecture

## Overview

VERDICT is a hiring verification platform that analyzes candidate CV claims against job requirements and public evidence. It combines deterministic rule-based analysis with optional LLM-backed auditing to produce scored, actionable candidate assessments.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Java 17 + Spring Boot 3.5 |
| Database | MySQL 8+ with Flyway migrations |
| ORM | Spring Data JPA (Hibernate) |
| Frontend | React 19 + Vite 8 |
| Real-time | Server-Sent Events (SSE) via EventSource |
| Message queue | RabbitMQ (optional, best-effort) |
| LLM | OpenAI-compatible API (gpt-4o-mini default) |
| CI/CD | GitHub Actions |
| Containerization | Docker / docker compose |
| Testing | JUnit 5 + Playwright (E2E) |

## Backend Architecture

### Package Structure

```
dev.toktab.brainhack
├── account/          # User accounts, sessions, roles, CLI pairing
├── admin/            # Admin authentication and session management
├── api/              # REST controllers (auth, projects, candidates, admin, audit)
├── ats/              # ATS keyword catalog and analysis templates
├── audit/            # Core audit engine (claim analysis, scoring, export)
├── config/           # Security, CORS, rate limiting, filtering
├── hiring/           # Hiring domain: projects, candidates, workflow, OSINT, invites
└── util/             # Shared utilities
```

### Controller Layer

Each domain has dedicated controllers:

- **AuthController** — register, login, refresh, CLI auth, session management
- **ProjectController** — project CRUD, listing, pagination
- **ProjectSettingsController** — project settings, announcements, ATS templates
- **ProjectTeamController** — team members, roles, permissions
- **CandidateController** — candidate CRUD, uploads, CV text extraction
- **CandidateReviewController** — notes, votes, status workflow
- **CandidateSignalTraceController** — OSINT runs, SignalTrace reports
- **InviteController** — invite creation and acceptance
- **AdminController** — user management, settings, health, table clearing
- **SystemController** — health, CLI installer downloads, evaluation dataset

### Service Layer

Domain services handle business logic:

- **UserSessionService** — password hashing, token generation, session lifecycle
- **HiringProjectService** — project CRUD, activity logging, requirement extraction
- **CandidateIntakeService** — adding candidates, CV uploads, text extraction
- **CandidateAnalysisService** — claim extraction, scoring, state management
- **CandidateWorkflowService** — voting, status transitions, reviewer notes
- **CandidateOsintService** — OSINT orchestration (GitHub evidence, public source checks)
- **ProjectInviteService** — invite tokens, acceptance flows
- **ProjectMemberService** — membership management, roles
- **GithubEvidenceService** — GitHub API integration, repository analysis

### Security Model

- BCrypt password hashing
- Stateless JWT tokens (access + refresh)
- CLI pairing via one-time passwordless codes (SHA-256 hashed)
- Admin authentication via dedicated Spring Security filter
- Request IDs for traceability
- Rate limiting per endpoint category
- Role-based access control per project (Viewer, Voter, Reviewer, Screener, Coordinator, Admin)
- Custom permissions (canVote, canAddNote, canManageTeam, etc.)

### Audit Engine

The `audit/` package implements the core claim analysis pipeline:

1. **Sentence splitting** — CV text broken into individual sentences
2. **Claim extraction** — sentences mapped to job requirements
3. **Analysis state** — 4 configurable states (Light, WAR, Person, WAR_AI)
4. **Verdict generation** — each claim gets a status (Supported, Stretched, Unsupported, Gap)
5. **Scoring** — weighted formula combining match, evidence, flags, and risk
6. **Export** — PDF, CSV, DOC formats

## Frontend Architecture

### Component Structure

```
front/src/
├── api/              # Domain-specific API modules
│   ├── authApi.js
│   ├── projectApi.js
│   ├── candidateApi.js
│   ├── messageApi.js
│   ├── adminApi.js
│   └── auditApi.js
├── components/       # Reusable UI components
│   ├── Header.jsx
│   ├── ui.jsx
│   ├── ErrorBoundary.jsx
│   ├── GlobalCompose.jsx
│   └── ...
├── hooks/            # Custom React hooks
│   ├── useRouteState.js
│   ├── useRealtime.js
│   └── useUnreadMessages.js
├── pages/            # Route-level page components
│   ├── projects/
│   │   ├── CandidateDetailPage.jsx
│   │   ├── ProjectDetailPage.jsx
│   │   └── ...
│   ├── AuditAnalysisPages.jsx
│   ├── MessagesPage.jsx
│   └── ...
├── styles/           # CSS files
├── utils/            # Utility functions
├── data/             # Default data (ATS templates, analysis states)
├── http.js           # HTTP client base
├── normalizers.js    # Data normalizers
├── App.jsx           # Application shell
├── AppRoutes.jsx     # Route definitions
├── AppShell.jsx      # Outer application shell
└── api.js            # Barrel re-export
```

### Data Flow

1. User action → Page component → API module → HTTP client → Backend endpoint
2. Backend processes → returns JSON response → Normalizer → Page re-render
3. Real-time events via SSE → useRealtime hook → Project/message state updates

## Database Schema

Key entities with JSON columns (kept for backward compatibility):

- `hiring_candidates` — main candidate entity (contains `claims_json`, `osint_report_json`)
- `candidate_analysis_runs` — immutable analysis run records
- `hiring_projects` — project/job entities
- `user_accounts` / `user_sessions` — authentication
- `audits` / `verdicts` — audit engine records
- `app_messages` — internal messaging

Normalized tables for claim data:

- `candidate_claims` — individual claims extracted from CV
- `candidate_osint_sources` — OSINT source findings per candidate

## Key Dependencies

- **MySQL** — primary data store
- **RabbitMQ** — optional event publishing (audit jobs, project events)
- **LLM API** — optional AI-backed analysis (OpenAI-compatible)
- **GitHub API** — optional OSINT evidence collection

## Deployment

See `docs/deployment.md` for container setup and production configuration.
