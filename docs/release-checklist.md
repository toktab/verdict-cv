# VERDICT Release Checklist

Use this before each demo, handoff, or deploy.

## Configuration

- Confirm `VERDICT_ALLOWED_ORIGINS` matches the deployed frontend origin.
- Confirm admin credentials are explicitly configured and are not `admin/admin`.
- Confirm the LLM key and selected model are present when AI-backed states are enabled.
- Confirm RabbitMQ is reachable when `verdict.rabbit.enabled=true`; otherwise verify executor fallback is intentional.
- Confirm database connection settings point to the intended environment.

## Data And Migrations

- Run the backend test suite against a clean database profile.
- Verify Flyway migrations apply from an empty database.
- Verify demo projects, sample candidates, and default audit templates load.
- Verify project invites can be created, accepted, and viewed from `/messages`.

## Product Flows

- Register, log in, refresh token, open dashboard, and log out.
- Create a project, add a candidate, re-run candidate analysis, and open candidate detail.
- Verify candidate votes, stars, status changes, reviewer notes, and Team activity log.
- Run SignalTrace only after consent and only in the WAR_AI state.
- Create a normal message and confirm the recipient unread badge updates.
- Accept an invite from a message and confirm shared project access.

## Exports And Evidence

- Export one audit as TXT, DOC, CSV, and PDF.
- Confirm exported reports include score, statuses, evidence pointers, template/state metadata, and timestamps.
- Confirm file extraction warnings appear for empty, short, garbled, or metadata-heavy uploads.

## Observability

- Confirm request IDs are present in API responses and structured errors.
- Check logs for audit duration, LLM failures, rate-limit responses, and queue dispatch/recovery events.
- Confirm failed audits show a specific failure type and message in progress/detail views.

## Frontend

- Run `npm run typecheck`.
- Run `npm run build`.
- Smoke-test desktop and mobile widths for dashboard, project detail, candidate detail, messages, and admin.
- Confirm one component failure is contained by the route error boundary.
