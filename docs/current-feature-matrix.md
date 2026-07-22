# Current Feature Matrix

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| User registration | ✅ Complete | AuthController | AuthPage | With validation |
| User login | ✅ Complete | AuthController | AuthPage | BCrypt + JWT |
| Token refresh | ✅ Complete | AuthController | — | Stateless refresh |
| CLI login (password) | ✅ Complete | AuthController | — | For terminal connectors |
| CLI pairing (passwordless) | ✅ Complete | AuthController | ProfilePage | One-time codes |
| CMD session management | ✅ Complete | AuthController | ProfilePage | List/revoke |
| Admin login | ✅ Complete | AdminController | AdminPage | Dedicated Spring Security filter |
| Admin user management | ✅ Complete | AdminController | AdminPage | CRUD |
| Admin health panel | ✅ Complete | AdminController | AdminPage | DB/LLM/RabbitMQ |
| Admin table clearing | ✅ Complete | AdminController | AdminPage | With confirmation |
| Admin ATS templates | ✅ Complete | AdminController | — | Versioned |
| Project CRUD | ✅ Complete | ProjectController | ProjectsPage | With soft delete |
| Project settings | ✅ Complete | ProjectSettingsController | ProjectSettingsPage | Configurable analysis |
| Project team | ✅ Complete | ProjectTeamController | ProjectTeamPage | Roles/permissions |
| Candidate intake | ✅ Complete | CandidateController | AddCandidatePage | CV text + file upload |
| Candidate analysis | ✅ Complete | CandidateAnalysisService | CandidateDetailPage | 4 states |
| Candidate reanalysis | ✅ Complete | CandidateAnalysisService | CandidateDetailPage | Refresh scoring |
| Candidate voting | ✅ Complete | CandidateReviewController | CandidateDetailPage | Upvote/downvote/star |
| Candidate status pipeline | ✅ Complete | CandidateWorkflowService | CandidateDetailPage | Unreviewed→Hired |
| Candidate notes | ✅ Complete | CandidateReviewController | CandidateDetailPage | Decision tracking |
| Candidate OSINT | ✅ Complete | CandidateOsintService | SignalTracePage | GitHub evidence |
| Candidate delete | ✅ Complete | CandidateController | CandidateDetailPage | Soft delete |
| Project invites | ✅ Complete | InviteController | — | Email + token |
| Messaging | ✅ Complete | — | MessagesPage | Send/reply/forward |
| Audit engine | ✅ Complete | AuditService | AuditWorkspacePage | 4 states |
| Audit export | ✅ Complete | ExportService | — | PDF/CSV/DOC |
| Audit templates | ✅ Complete | AuditTemplateService | AuditWorkspacePage | Default + custom |
| Verdict revisions | ✅ Complete | VerdictRevisionService | — | Immutable history |
| ATS keyword scanning | ✅ Complete | AtsKeywordCatalog | CandidateDetailPage | Match report |
| Candidate memory | ⚠️ Partial | CandidateAnalysisService | CandidateDetailPage | Per-org matching |
| GitHub evidence | ⚠️ Partial | GithubEvidenceService | SignalTracePage | Profile + repos |
| Realtime events | ⚠️ Partial | — | useRealtime hook | SSE-based |
| Notification prefs | ✅ Complete | AuthController | ProfilePage | Mute timing |
| Request ID tracing | ✅ Complete | — | — | X-Request-Id header |
| Rate limiting | ✅ Complete | — | — | Per-category config |
| Error boundaries | ✅ Complete | — | AppShell | Route-level |
| Loading skeletons | ✅ Complete | — | — | Per page |
| i18n (GE/EN) | ⚠️ Partial | — | i18n.jsx | Not all strings translated |
| Mobile responsive | ⚠️ Partial | — | — | Dashboard + detail |
| CI pipeline | ⚠️ Partial | — | — | Tests skip in Docker |
| Human review labels | 🔲 Planned | — | CandidateDetailPage | Score annotations |
| Claims normalization | 🔲 Planned | CandidateAnalysisService | — | Relational tables |
| Architecture docs | 🔲 Planned | — | — | This document |

Key: ✅ Complete, ⚠️ Partial/Needs work, 🔲 Planned
