# VERDICT Frontend — Integration TODO

## Connected (works now)

- **Auth**: register, login, logout, `/auth/me` — backed by `app_user` table
- **Hiring projects**: list, create, detail — backed by `hiring_project` table
- **Add candidate to project**: saves CV text to `project_candidate` table
- **Projects page**: reads live data from API, falls back gracefully when backend is unreachable
- **Vite proxy**: `/api/*` → `http://localhost:8000` in dev; no CORS issues

## TODO — Backend missing, frontend has UI

### High priority (core workflow)

- **Candidate scoring / verdict display** (`CandidateDetailPage`)
  - Frontend shows: score, match%, risk, supported/stretched/unsupported counts, per-claim rows
  - Backend: `project_candidate` stores these fields but they are all defaulted to zero after initial save
  - Need: a scoring step that runs after CV is saved and writes back to `project_candidate`
  - Likely approach: AI/LLM claim extraction + catchphrase rule scoring → update `project_candidate.score`, `.risk`, `.claims`, etc.

- **Signal Trace / OSINT** (`SignalTracePage`)
  - Frontend: shows sources (GitHub, LinkedIn, web search, etc.) and a "Run trace" button
  - Backend: `/stages/enqueue` endpoint exists and OSINT adapters are implemented
  - Need: wire the "Run OSINT" button to `POST /api/stages/enqueue` with the correct `candidate_id` and `stage`
  - Blocked on: `project_candidate` ↔ `candidate` (VERDICT core) link — right now they are separate

- **Profiling Mode** (`CandidateProfilePage`)
  - Frontend: highlights risky phrases from JSON rules in the candidate's CV text
  - Currently uses demo data; needs the real CV text from `project_candidate.cv_text`
  - Fix: pass `cv_text` from the candidate object to the profiling highlighter

### Medium priority

- **Candidate update after OSINT** — write OSINT results back to `project_candidate` (score, osint status, evidence)
- **Candidate memory** — detect repeat applicants across projects; match by name or email; show history banner
- **Project delete** — frontend has no delete button for projects yet (backend endpoint exists at `DELETE /projects/{id}`)
- **Candidate delete** — same (backend endpoint exists at `DELETE /projects/{id}/candidates/{id}`)
- **Pagination for project candidates** — currently loads all; add `?limit=&offset=` to `/projects/{id}/candidates`

### Low priority / intentionally deferred

- **Admin panel** — no backend support; user management, audit log, settings all still run on localStorage
- **Audit templates** — still localStorage-only (demoTemplates)
- **Audit states selector** — still demoStates (Light/WAR/Person/WAR+AI); not persisted or enforced server-side
- **Audit workspace** (the `/audit` route) — sentence-level verdicts, credibility score, audit history
  - Backend has `VerificationCase` + `Evidence` + `ScoreSnapshot` but in a different shape
  - Frontend expects: `{verdicts: [{sentence, status, confidence, explanation}]}`
  - Need an adapter endpoint or a new LLM-based claim verifier
- **Export** (TXT / Word / Excel / PDF) — no backend endpoint; the frontend calls `/api/audit/{id}/export`
- **Dashboard audit history** — uses localStorage only; needs real API
- **Email verification** — frontend has the UI flow, backend has no email sending

## Running the stack

```
# 1. Start database + redis
docker compose up -d

# 2. Run migrations
uv run alembic upgrade head

# 3. Start backend (separate terminal)
uv run uvicorn app.main:app --reload

# 4. Start frontend (separate terminal)
cd frontend
npm run dev
# → http://localhost:5173
```
