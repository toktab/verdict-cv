# Security & Compliance

## Authentication

- **Password storage**: BCrypt with configurable salt rounds
- **Token format**: JWT with access (short-lived) and refresh (long-lived) tokens
- **Session model**: Stateless; tokens carry user identity
- **CLI pairing**: One-time SHA-256 hashed codes with 5-minute expiry
- **Admin authentication**: Dedicated Spring Security Authentication implementation

## Authorization

- **Project roles**: Viewer, Voter, Reviewer, Screener, Coordinator, Admin, Organization Admin, Custom
- **Custom permissions**: canView, canVote, canAddNote, canManageTeam, canManageInvites, canDeleteProject, canRemoveMember, canExport, canConfigureAudit
- **API authorization**: Token-based with header validation (Authorization: Bearer or X-User-Token)
- **Admin isolation**: Admin endpoints use separate authentication filter with ADMIN role

## Data Protection

- **Password never stored in plaintext**
- **Email storage**: Candidate emails extracted from CV text on analysis
- **Soft delete**: Users, projects, and candidates support soft deletion
- **JSON snapshots**: Claims and OSINT reports stored as JSON for immutability

## API Security

- **CORS**: Configurable allowed origins (defaults to localhost)
- **Rate limiting**: Configurable per endpoint category (auth, audit, admin)
- **Request ID tracking**: X-Request-Id header on all responses
- **HTTPS enforcement**: Production profile requires HTTPS
- **Input validation**: Jakarta Validation annotations on all request DTOs
- **File size limits**: 8MB max upload, enforced in controller

## OSINT Privacy

- **Consent gate**: External source checks require explicit user consent
- **Public data only**: Only public APIs and user-provided links are checked
- **No scraping**: LinkedIn, social media are not scraped
- **Cautious language**: "Not found" is distinct from "contradicted"
- **Source visibility**: Every external check is shown with URL and timestamp

## Compliance Notes

- Candidate data is user-submitted CV text; no special category data is collected
- OSINT checks are opt-in and transparent to all project members
- Audit history is append-only; verdict revisions preserve change history
- Table clearing operations are logged with admin identity and affected row counts
- Production deployments must set VERDICT_ALLOW_DEFAULT_ADMIN=false

## Security Test Coverage

The following test scenarios are covered in AuthAuditAdminFlowTest:
- Authentication required for protected endpoints
- Token ownership enforced (users cannot access each other's audits)
- Admin-only endpoints reject regular user tokens
- CLI session lifecycle (create, refresh, revoke)
- CLI pairing code one-time usage
- Request ID propagation on errors
