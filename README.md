# VERDICT

**Resumes say a lot. Evidence says more.**

VERDICT is a hiring verification platform. You give it a job description and a candidate's CV, and it checks every claim in the CV against the job requirements and against public evidence such as the candidate's GitHub. The result is a scored, explained report that tells you which claims are backed up, which are stretched, and what to ask in the interview.

> Confidence is not evidence.

---

## Contents

- [Why VERDICT](#why-verdict)
- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack and versions](#tech-stack-and-versions)
- [What you need](#what-you-need)
- [Quick start (local, for development)](#quick-start-local-for-development)
- [Run as a single app (production build)](#run-as-a-single-app-production-build)
- [Run with Docker](#run-with-docker)
- [Configuration (.env)](#configuration-env)
- [Website tutorial](#website-tutorial)
- [The four analysis states](#the-four-analysis-states)
- [SignalTrace: public GitHub evidence](#signaltrace-public-github-evidence)
- [VERDICT CLI (Windows command-line client)](#verdict-cli-windows-command-line-client)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Security and privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Author](#author)

---

## Why VERDICT

Recruiters and hiring managers read hundreds of CVs, and most of them read well. The hard part isn't finding a CV that matches the keywords; it's knowing which claims are real.

VERDICT helps with that:

- **Every claim gets checked.** The CV is split into individual statements, and each one is compared with the job requirements.
- **Claims are backed by evidence.** Public sources such as GitHub are checked to see if the candidate's actual work matches what the CV says.
- **The result is explained.** Every claim gets a status and a reason, so you can see *why* a candidate scored the way they did.
- **It points you to the interview questions.** VERDICT doesn't replace the interview. It tells you which claims to dig into.
- **It never accuses anyone.** "Not found" is never treated as "lied". Missing public evidence is reported as missing, nothing more.

---

## How it works

1. **Paste or upload a CV** (PDF, DOCX or TXT) and a **job description**.
2. **Sentence splitting:** the CV text is broken into individual sentences.
3. **Claim extraction:** each sentence is mapped to the job requirements it relates to.
4. **Verdict:** each claim gets one of four statuses:

   | Status | Meaning |
   | --- | --- |
   | **Supported** | The CV gives concrete evidence for this claim. |
   | **Stretched** | The claim goes further than the evidence shows. |
   | **Unsupported** | Nothing in the CV backs this claim up. |
   | **Gap** | A job requirement the CV never addresses. |

5. **Scoring:** a weighted formula combines match quality, evidence strength, warning flags and risk into a **0–100 score** and a **1–10 score level** with plain-language explanations.
6. **Public evidence (optional, with consent):** SignalTrace checks the candidate's public GitHub and compares it with the CV.
7. **Review:** your team votes, adds notes and moves the candidate through the pipeline.
8. **Export:** reports can be exported as PDF, CSV or DOC.

---

## Features

### Analysis

- Four analysis states, from a fast local check to AI and built-in rules working together ([details](#the-four-analysis-states))
- Claim-by-claim verdicts with reasons
- 0–100 recommendation score, ATS keyword coverage, verified-evidence score, GitHub relevance and reviewer consensus
- Risk level (Low / Medium / High)
- Match Rate view: CV and job description side by side, with matching and missing skills highlighted
- Searchability and recruiter tips (contact info, section headings, job-title match, word count, measurable results)
- If the AI provider is missing or fails, the analysis still finishes on a clearly labelled local engine

### Candidate intake

- Paste CV text or upload a PDF, DOCX or TXT file (up to 8 MB)
- Drag and drop a file straight onto the text box
- Live character, word and line counts, plus an estimated "ATS pages" figure with a warning above about 2 pages
- **Compare with original:** a side-by-side diff of the raw extracted text and the cleaned text that will be analysed
- Repeat-applicant detection across projects (candidate memory)

### Hiring workflow and teams

- Hiring projects (jobs), grouped by organization
- Candidate pipeline: **Unreviewed → OnCheck → OnInterview → Hired / Closed**
- Reviewer voting (0.5–5 score, downvote, star) and reviewer notes with decisions
- Project roles: Viewer, Voter, Reviewer, Screener, Coordinator, Admin, Organization Admin, plus custom roles with hand-picked permissions
- Invites, team management and a full activity log per project
- Internal messaging, announcements and live updates without refreshing (Server-Sent Events)

### Public evidence (SignalTrace)

- Finds GitHub, LinkedIn and portfolio links in the CV automatically
- Official GitHub REST API, no scraping: profile, repositories, languages, READMEs, stars, forks, recency
- Repository depth score and technology match against the job
- Consent gate: external checks only run when a team member records the candidate's consent

### Admin

- Separate admin login
- User management, system settings, ATS analysis templates
- Health dashboard (database, AI provider, RabbitMQ)
- Guarded data clearing: you must type a generated confirmation phrase, and every clear is logged

### VERDICT CLI

- A full Windows command-line client with 20+ commands ([details](#verdict-cli-windows-command-line-client))
- Passwordless pairing with a one-time code
- Credentials encrypted with Windows DPAPI
- Standalone `verdict.exe`, installer and self-update with checksum verification

---

## Tech stack and versions

| Part | Technology | Version |
| --- | --- | --- |
| Backend | Java + Spring Boot | Java 17+, Spring Boot 3.5.15 |
| Backend app version | `dev.toktab:brainhack` | 0.0.1-SNAPSHOT |
| Database | MySQL + Flyway migrations | MySQL 8+ (Docker uses 8.4), 29 migrations |
| ORM | Spring Data JPA (Hibernate) | via Spring Boot |
| Security | Spring Security, BCrypt, JWT | via Spring Boot |
| API docs | springdoc-openapi (Swagger UI) | 2.8.9 |
| Frontend | React + React Router + Vite | React 19, React Router 7, Vite 8 |
| Frontend language | JavaScript/JSX + TypeScript checks | TypeScript 6 |
| Realtime | Server-Sent Events | — |
| Message queue | RabbitMQ (optional) | 3.13 in Docker |
| AI | Any OpenAI-compatible chat API (optional) | default model `gpt-4o-mini` |
| CLI | Node.js | **CLI version 1.1.0**, Node 22+ |
| Tests | JUnit 5, Playwright, node:test | — |
| CI | GitHub Actions | Java 21, Node 22 |
| Containers | Docker, Docker Compose | — |

---

## What you need

| To do this | You need |
| --- | --- |
| Run the backend | **Java 17 or newer** (JDK, not just JRE). Java 21 works too. |
| Run the frontend in dev mode | **Node.js 22 or newer** and npm |
| Store data | **MySQL 8 or newer**, running locally or reachable over the network |
| Use the AI analysis states (optional) | An API key for an OpenAI-compatible chat-completions API |
| Raise the GitHub rate limit (optional) | A GitHub personal access token (read-only, public repos) |
| Run with Docker (optional) | Docker Desktop with Docker Compose |
| Use the CLI | Windows 10/11 (Node 22+ only if you run the script version) |

You do **not** need Maven installed: the project includes the Maven wrapper (`mvnw` / `mvnw.cmd`).

---

## Quick start (local, for development)

This runs the backend on port **8080** and the frontend dev server on port **5173**. The frontend sends all `/api` calls to the backend.

### 1. Get the code

```bash
git clone https://github.com/toktab/verdict-cv.git
cd verdict-cv
```

### 2. Create your `.env`

Copy the example file and edit it:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

At minimum, set a MySQL user and password the backend can use:

```properties
DB_USERNAME=root
DB_PASSWORD=your-mysql-password
VERDICT_ADMIN_USERNAME=admin
VERDICT_ADMIN_PASSWORD=choose-a-strong-password
```

The database `verdict` is created automatically on first start, and Flyway creates all tables. See [Configuration](#configuration-env) for every option.

### 3. Start the backend

Run it **from the project root**, so it finds your `.env`:

```powershell
# Windows
.\mvnw.cmd spring-boot:run
```

```bash
# macOS / Linux
./mvnw spring-boot:run
```

Or open the project in IntelliJ IDEA and run the Spring Boot application class under `back/src/main/java/dev/toktab/brainhack/`. Make sure the working directory is the project root.

The first run downloads dependencies and takes a few minutes. Wait until the log says `Started ... in X seconds`.

### 4. Start the frontend

In a second terminal:

```bash
cd front
npm install
npm run dev
```

### 5. Open VERDICT

Go to **http://localhost:5173** in your browser, register an account and follow the [website tutorial](#website-tutorial).

---

## Run as a single app (production build)

The frontend can be built into the backend, so everything runs from one Java process on port 8080.

```bash
cd front
npm install
npm run build        # builds into back/src/main/resources/static
cd ..
./mvnw package       # Windows: .\mvnw.cmd package
java -jar target/brainhack-0.0.1-SNAPSHOT.jar
```

Open **http://localhost:8080**.

For a real deployment, start it with the production profile:

```bash
SPRING_PROFILES_ACTIVE=prod java -jar target/brainhack-0.0.1-SNAPSHOT.jar
```

The production profile **refuses to start** unless `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `VERDICT_ADMIN_USERNAME`, `VERDICT_ADMIN_PASSWORD` and `VERDICT_ALLOWED_ORIGINS` are set, and it requires HTTPS. See [docs/deployment.md](docs/deployment.md).

---

## Run with Docker

Docker Compose starts the app, MySQL 8.4 and RabbitMQ together.

1. Copy `.env.example` to `.env` and replace **every** `change_me_*` value. Compose refuses to start if the database or RabbitMQ passwords are missing.
2. Build and start:

   ```bash
   docker compose up --build
   ```

3. Open **http://localhost:8080**.

Optional: a Linux Python workspace for OSINT tools:

```bash
docker compose --profile osint up -d osint-tools
docker compose exec osint-tools sh
```

| Service | Port | Purpose |
| --- | --- | --- |
| app | 8080 (`APP_PORT`) | VERDICT web app and API |
| mysql | 3306 (`MYSQL_PORT`) | Database |
| rabbitmq | 5672, 15672 | Optional event queue and its management UI |

---

## Configuration (.env)

All settings live in the `.env` file in the project root. Restart the backend after changing it.

### Database

| Variable | Default | Description |
| --- | --- | --- |
| `DB_URL` | `jdbc:mysql://localhost:3306/verdict?createDatabaseIfNotExist=true&...` | JDBC URL. The default creates the `verdict` database if it doesn't exist. |
| `DB_USERNAME` | — | MySQL user (when running from IntelliJ or Maven) |
| `DB_PASSWORD` | — | MySQL password |
| `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PORT` | `verdict`, `verdict`, —, —, `3306` | Used by Docker Compose |

### App and admin

| Variable | Default | Description |
| --- | --- | --- |
| `APP_PORT` | `8080` | Port the app is exposed on (Docker) |
| `VERDICT_ADMIN_USERNAME` | `admin` | Admin panel username |
| `VERDICT_ADMIN_PASSWORD` | — | Admin panel password. **Set a strong one.** |
| `VERDICT_ALLOW_DEFAULT_ADMIN` | `false` | Allows the built-in `admin/admin` login. Only for isolated local testing. |
| `VERDICT_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:8080` | Allowed browser origins (CORS). Use your exact HTTPS origin in production, never `*`. |
| `VERDICT_REQUIRE_HTTPS` | `false` | Require HTTPS (always on in the `prod` profile) |

### Rate limiting

| Variable | Default |
| --- | --- |
| `VERDICT_RATE_LIMIT_ENABLED` | `true` |
| `VERDICT_RATE_LIMIT_WINDOW_SECONDS` | `60` |
| `VERDICT_RATE_LIMIT_AUTH_REQUESTS` | `10` |
| `VERDICT_RATE_LIMIT_AUDIT_REQUESTS` | `20` |
| `VERDICT_RATE_LIMIT_ADMIN_REQUESTS` | `60` |

### AI provider (optional)

Only the **Person** and **WAR+AI** states use AI. Without a key they fall back to a local engine.

| Variable | Default | Description |
| --- | --- | --- |
| `VERDICT_LLM_API_KEY` | empty | Your API key. Never commit it. |
| `VERDICT_LLM_URL` | `https://api.openai.com/v1/chat/completions` | Any OpenAI-compatible endpoint |
| `VERDICT_LLM_MODEL` | `gpt-4o-mini` | A model your key has access to |
| `VERDICT_LLM_TEMPERATURE` | `0.2` | |
| `VERDICT_LLM_TIMEOUT_SECONDS` | `20` | |
| `VERDICT_LLM_MAX_ATTEMPTS` | `3` | Retries with backoff |
| `VERDICT_LLM_BACKOFF_MILLIS` | `500` | |
| `VERDICT_LLM_INPUT_COST_PER_MILLION` | `0.15` | Used to show estimated cost per analysis |
| `VERDICT_LLM_OUTPUT_COST_PER_MILLION` | `0.60` | |

### GitHub, RabbitMQ and limits

| Variable | Default | Description |
| --- | --- | --- |
| `GITHUB_TOKEN` | empty | Optional. Raises the GitHub API limit from about 60 to 5,000 requests per hour. |
| `VERDICT_RABBITMQ_ENABLED` | `false` | Turn on RabbitMQ events |
| `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`, `RABBITMQ_PORT`, `RABBITMQ_MANAGEMENT_PORT` | `verdict`, —, `5672`, `15672` | RabbitMQ connection |
| `VERDICT_RABBITMQ_EXCHANGE` | `verdict.events` | |
| `VERDICT_MAX_CLAIM_CHARS` | `12000` | Maximum claim text length |
| `VERDICT_MAX_EVIDENCE_CHARS` | `20000` | Maximum evidence text length |
| `VERDICT_MAX_SENTENCES` | `60` | Maximum sentences analysed per CV |

---

## Website tutorial

A full walkthrough, from first login to a finished candidate report.

### 1. Create an account

1. Open the app (http://localhost:5173 in dev mode, or http://localhost:8080).
2. Click **Register**, fill in your details and sign in.
3. You land on the **Dashboard**, which shows your recent audits and workspace health.

### 2. Create a job (hiring project)

1. Go to **Projects** → **New job description**.
2. Enter the job title, department (for example *Engineering*), location and work mode.
3. Paste the **job description**, including a clear list of requirements. Each requirement becomes something VERDICT checks the CV against, so one requirement per line works best.
4. Choose the **analysis state** for this job (see [the four analysis states](#the-four-analysis-states)). WAR is a good default.
5. Save. The job appears under **Jobs under review**.

### 3. Add a candidate

1. Open the job and click **Add candidate**.
2. Enter the candidate's name.
3. Add the CV in one of three ways:
   - drag a PDF/DOCX/TXT file onto the CV box,
   - click **Upload PDF/DOCX/TXT**, or
   - paste the text directly.
4. Check the live stats under the text box. If you uploaded a PDF, click **Compare with original** to make sure the text was extracted correctly.
5. Click **Analyze candidate**.

### 4. Read the result

The result appears right away ("*Name* scored against *Job*"), with the number of supported, stretched and unsupported claims. Open the candidate to see the full report:

- **Overview:** recommendation score, ATS keyword coverage, verified evidence, GitHub relevance, reviewer consensus, risk, and a recruiter-ready summary with the suggested next action.
- **Fit:** the Match Rate ring, the side-by-side view of CV and job description, searchability checks, the skills table (matching vs. missing skills) and recruiter tips.
- **Evidence:** every claim with its status and reason, the technology matrix, and the GitHub evidence card.
- **Review:** the status pipeline, votes and reviewer notes.

The job page also shows the best candidate, the review funnel, risk clusters and requirement coverage across all candidates.

### 5. Check public evidence with SignalTrace

1. On the candidate page, click **SignalTrace**.
2. VERDICT lists the links it found in the CV (GitHub, LinkedIn, portfolio).
3. Tick **Candidate consent is recorded for this SignalTrace check**. Nothing external is checked without it.
4. Choose which checks to run and click **Check information**.
5. The report shows what the public profile actually shows: identity confidence, repository count and depth, language distribution, latest projects, and a claim-by-claim comparison of the CV against public repositories.

### 6. Review as a team

1. Open **Members** on the job to invite teammates and set their roles.
2. Reviewers vote on candidates, add notes and move them through **Unreviewed → OnCheck → OnInterview → Hired / Closed**.
3. Use **Messages** for internal discussion and announcements. Updates appear live.

### 7. Export and re-run

- **Export** a candidate report as PDF, CSV or DOC.
- **Re-run analysis** after changing the analysis state or the job description.
- **History** lists your past audits.

### 8. Quick audits without a project

Go to **Audit** to check any claim text against any evidence text directly, in any of the four states, without creating a job.

### 9. Admin panel

Go to **/admin** and sign in with `VERDICT_ADMIN_USERNAME` / `VERDICT_ADMIN_PASSWORD` from your `.env`. From there you can manage users, change system settings, manage ATS templates, check system health and view the activity log.

---

## The four analysis states

| State | Strictness | Uses AI | Engine | Best for |
| --- | --- | --- | --- | --- |
| **Light** | 2/10 | No | `LOCAL_LIGHT_V2` | A fast first pass. Catches only obvious gaps. Free. |
| **WAR** | 7/10 | No | `LOCAL_WAR_V2` | The default. Every claim needs concrete evidence ("evidence pressure"), and risky wording is flagged. Free. |
| **Person** | 6/10 | Yes | LLM, or `LOCAL_PERSON_FALLBACK_V2` | Reads the candidate as a person: context, paraphrases, transferable skills. |
| **WAR+AI** | 10/10 | Yes | `LOCAL_STRICT_V2` + LLM | The strictest. Both engines run and the stricter verdict wins for each claim. |

- If no AI key is set, or the provider is down, Person and WAR+AI **still finish** on a clearly named local fallback.
- Every run records the selected state, the engine actually used, the prompt version, token counts and estimated cost.
- AI prompts are versioned files under `back/src/main/resources/prompts/audit/`. They treat CV text as untrusted data, reject prompt injection and require exact evidence quotes.

More: [docs/four-states.md](docs/four-states.md)

---

## SignalTrace: public GitHub evidence

- Uses the **official GitHub REST API** only. No scraping.
- Collects: public profile, repositories, language bytes per repo, READMEs, stars, forks, recency; detects forks and stale repositories.
- Calculates a **repository depth score** and a **technology match** against the job's skills.
- Every finding is shown with its exact source URL and timestamp.
- Language is careful: a missing finding is reported as *no public evidence*, never as a lie.
- **LinkedIn is never scraped.** Use links or text the candidate provides.
- Set `GITHUB_TOKEN` if you run many checks: without it GitHub allows about 60 requests per hour.

---

## VERDICT CLI (Windows command-line client)

**Current version: 1.1.0**

The CLI gives you the whole platform from a Windows terminal: projects, candidates, audits, messages, team, reports and admin.

### Install

**Option A: from your running VERDICT server (recommended)**

Download and run the installer from:

```
http://localhost:8080/api/system/cli/installer
```

This downloads `install-verdict.cmd`, which:

- installs to `%LOCALAPPDATA%\VERDICT CLI`,
- checks for Node.js 22+ and installs the LTS version with winget if needed,
- adds `verdict` to your PATH,
- creates Start Menu shortcuts and an uninstaller,
- pre-configures the server URL.

Other files the server provides under `/api/system/cli/files/`: `verdict.exe`, `verdict.exe.sha256`, `VERDICT-Setup-Windows-x64.exe`, `VERDICT-Setup-Windows-x64.exe.sha256`, `verdict.mjs`, `install-verdict.ps1`, `README.txt`.

**Option B: from this repository**

Prebuilt binaries are in [`dist/`](dist): `verdict.exe` and `VERDICT-Setup-Windows-x64.exe`, each with a `.sha256` checksum. Or run the script directly with Node 22+:

```powershell
node tools\verdict-cli\verdict.mjs help
```

### Connect to your account

The safest way is **passwordless pairing**:

1. In the website, open **Profile** and create a CLI pairing code.
2. In the terminal:

   ```powershell
   verdict setup                       # choose profile name and server URL
   verdict connect ABCD-EFGH --name "Home PC"
   verdict whoami
   ```

The code is single-use, valid for 5 minutes and only stored as a hash. Your terminal then appears under **Profile → CMD connectors**, with its IP and last access, and you can revoke it instantly.

You can also sign in with your password: `verdict login --user yourname`.

Credentials are encrypted with **Windows DPAPI** and stored in `%APPDATA%\VERDICT\credentials.json`.

### Commands

| Group | Actions |
| --- | --- |
| `projects` | list, show, create, delete, open |
| `candidates` | list, show, upload, add, analyze, status, note, vote, delete, open |
| `audits` | list, show, run, watch, cancel, export, open |
| `messages` | list, show, send, reply, forward, read, unread, star, archive, watch |
| `team` | list, invites, invite, accept, role, kick |
| `activity` | list, export, watch |
| `announcements` | list, post, pin, unpin, delete |
| `ats` | list, show, export, import, validate |
| `signaltrace` | run, show |
| `admin` | login, logout, health, users, audits, logs, settings, clear-targets, clear |

Other commands: `setup`, `connect`, `login`, `whoami`, `doctor`, `logs`, `dashboard`, `shell`, `reports`, `notifications`, `batch`, `update`, `uninstall`, `health`, `watch`, `open`, `config`, `profile`, `session`, `version`, `help`.

Global options:

```
--profile NAME   --server URL   --output table|json|jsonl|csv|text|quiet
--search TEXT    --page N       --size N       --fields a,b,c
--dry-run        --yes          --no-color     --verbose
```

### Examples

```powershell
verdict doctor                                         # check server and connection
verdict dashboard                                      # terminal workspace overview
verdict projects list --search Java
verdict candidates upload --project 3 --file "C:\CVs\candidate.pdf"
verdict candidates show --project 3 12
verdict audits run --claim-file cv.txt --evidence-file job.txt
verdict signaltrace run --project 3 --candidate 12
verdict messages send --to reviewer --subject "Candidate review" --body "Please check candidate 12"
verdict reports audit 42 --format pdf
verdict reports project --project 3 --out candidates.csv
verdict watch messages                                 # live events
verdict notifications mute 15m
verdict candidates list --project 3 --output csv > candidates.csv
verdict batch run tools\verdict-cli\workflow.example.json
verdict update                                         # self-update, verifies SHA-256
verdict uninstall --yes
verdict help projects
```

### Batch workflows

A JSON file can run a list of commands in order and stop at the first error. See [`tools/verdict-cli/workflow.example.json`](tools/verdict-cli/workflow.example.json).

### Exit codes

| Code | Meaning | Code | Meaning |
| --- | --- | --- | --- |
| 1 | General error | 9 | Timeout |
| 2 | Bad argument | 10 | Job failed |
| 3 | Not signed in | 11 | Declined |
| 4 | Forbidden | 12 | Partial result |
| 5 | Not found | 13 | Version problem |
| 6 | Conflict | 14 | File error |
| 7 | Validation error | 15 | Rate limited |
| 8 | Network error | | |

### Build the CLI yourself

```powershell
node tools\build-sea.js                          # builds the standalone verdict.exe
powershell -File tools\build-windows-installer.ps1
node --test tools\verdict-cli\verdict.test.mjs   # CLI tests
```

---

## Testing

```bash
# Backend (JUnit 5)
./mvnw test                    # Windows: .\mvnw.cmd test

# Frontend
cd front
npm test                       # unit tests
npm run lint                   # oxlint
npm run typecheck              # TypeScript checks
npm run build                  # production build
npx playwright install chromium
npm run e2e                    # Playwright browser smoke tests

# CLI
node --test tools/verdict-cli/verdict.test.mjs
```

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the frontend tests, lint, typecheck, build, Playwright smoke tests and backend tests on every push and pull request.

Sample CVs and job descriptions for manual testing are in [`tools/examples/`](tools/examples).

---

## Project structure

```
verdict-cv/
├── back/src/main/java/dev/toktab/brainhack/
│   ├── account/     # users, sessions, roles, CLI pairing
│   ├── admin/       # admin authentication
│   ├── api/         # REST controllers
│   ├── ats/         # ATS keyword catalog and templates
│   ├── audit/       # claim analysis engine, scoring, export
│   ├── config/      # security, CORS, rate limiting
│   ├── hiring/      # projects, candidates, workflow, OSINT, invites
│   └── util/
├── back/src/main/resources/
│   ├── application.properties
│   ├── application-prod.properties
│   ├── db/migration/          # Flyway migrations
│   ├── prompts/audit/         # versioned AI prompts
│   └── static/                # built frontend (generated)
├── front/                     # React + Vite frontend
│   ├── src/api/               # API modules per domain
│   ├── src/pages/             # route pages
│   ├── src/components/
│   ├── src/hooks/
│   └── e2e/                   # Playwright tests
├── tools/
│   ├── verdict-cli/           # the CLI (verdict.mjs)
│   ├── installer/             # Windows installer scripts
│   ├── osint/                 # OSINT helper scripts
│   └── examples/              # sample CVs and jobs
├── dist/                      # prebuilt CLI binaries
├── docs/                      # architecture, deployment, security docs
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── pom.xml
```

API documentation (Swagger UI) is available while the backend runs, at **http://localhost:8080/api/docs/ui** (OpenAPI JSON at `/api/docs`). It's turned off in the `prod` profile.

Main API areas:

| Path | Purpose |
| --- | --- |
| `/api/auth` | register, login, refresh, CLI login and pairing |
| `/api/projects` | jobs (hiring projects), settings, team |
| `/api/projects/{projectId}/candidates` | candidates, analysis, reviews |
| `/api/projects/{projectId}/candidates/{candidateId}/osint` | SignalTrace / public evidence |
| `/api/audit` | standalone audits |
| `/api/messages` | internal messaging |
| `/api/realtime` | live updates (Server-Sent Events) |
| `/api/admin` | admin panel |
| `/api/system` | health check, CLI version and downloads |

---

## Security and privacy

- Passwords hashed with **BCrypt**; stateless **JWT** access and refresh tokens
- **Passwordless CLI pairing**: single-use, 5-minute, SHA-256-hashed codes; every terminal is listed and revocable
- CLI credentials encrypted with **Windows DPAPI**
- Admin login separated from user login
- Role-based permissions **enforced on the server**, not just in the UI
- Rate limiting per endpoint group, a request ID on every response, input validation on every request, 8 MB upload limit
- AI prompts hardened against **prompt injection**; CV text is always treated as data
- **Consent gate** for any external evidence check; source URLs and timestamps on every finding
- Production profile **fails closed**: no default credentials, HTTPS required, explicit origins only
- Destructive admin actions require a typed confirmation phrase and are logged

Never commit your `.env` file or real API keys.

More: [docs/security-and-compliance.md](docs/security-and-compliance.md)

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `The JAVA_HOME environment variable is not defined correctly` | Install a JDK 17+ (for example `winget install EclipseAdoptium.Temurin.21.JDK`) and set `JAVA_HOME` to its folder, then open a new terminal. |
| `java` is not recognized | Add `%JAVA_HOME%\bin` to your PATH, or start the backend from IntelliJ. |
| PowerShell: `npm.ps1 cannot be loaded because running scripts is disabled` | Use `npm.cmd install` and `npm.cmd run dev`, or run the commands in cmd. |
| PowerShell: `mvnw.cmd` is not recognized | Write `.\mvnw.cmd` in PowerShell. |
| `Access denied for user` (MySQL) | Check `DB_USERNAME` and `DB_PASSWORD` in `.env`, and start the backend from the project root so `.env` is found. |
| Port 8080 already in use | Stop the other app, or change the port and update the `/api` proxy in `front/vite.config.js`. |
| Login fails in the frontend | Make sure the backend is running on 8080 before using the dev server on 5173. |
| Person / WAR+AI show "local fallback" | No AI key is set, or the provider is unreachable. Set `VERDICT_LLM_API_KEY` and restart. |
| SignalTrace stops working after a few runs | You hit the GitHub API rate limit. Add `GITHUB_TOKEN` to `.env`. |
| PDF text looks wrong | Use **Compare with original** on the Add candidate page, or paste the text instead. |

---

## Documentation

| File | What's in it |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Backend and frontend architecture |
| [docs/product-scope.md](docs/product-scope.md) | Full feature list |
| [docs/current-feature-matrix.md](docs/current-feature-matrix.md) | Feature status |
| [docs/four-states.md](docs/four-states.md) | The analysis states and AI setup |
| [docs/deployment.md](docs/deployment.md) | Docker and production deployment |
| [docs/security-and-compliance.md](docs/security-and-compliance.md) | Security model |
| [docs/osint-investigator-mode.md](docs/osint-investigator-mode.md) | Roadmap for a full investigator mode |
| [docs/release-checklist.md](docs/release-checklist.md) | Release checklist |
| [docs/smoke-checklist.md](docs/smoke-checklist.md) | Manual smoke tests |

---

## Author

**Tornike (Toko) Tabagari**, backend / full-stack developer, Tbilisi, Georgia

- GitHub: [@toktab](https://github.com/toktab)
- LinkedIn: [linkedin.com/in/toktab](https://www.linkedin.com/in/toktab)

Feedback and ideas are welcome: open an issue or reach out on LinkedIn.
