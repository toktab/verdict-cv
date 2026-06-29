# OSINT Investigator Mode

This is the senior path for adding external evidence to VERDICT without turning
the product into a brittle scraper.

## Scope

Use opt-in, user-provided, public, or authorized data only.

- GitHub: use the official public REST API for profile repositories, repository
  languages, topics, README text, stars, forks, and recency.
- LinkedIn: do not scrape. For free testing, accept text copied by the user,
  a candidate-provided profile export, or a manually pasted Skills/Experience
  section.
- CV: treat the CV as claims. Treat GitHub/LinkedIn text as evidence, not as
  truth by itself.

## Free Test Pipeline

1. Candidate input:
   - `github_username`
   - claimed skills from CV
   - optional pasted LinkedIn/CV text

2. GitHub collection:
   - fetch owned public repositories
   - skip forks by default
   - fetch GitHub language bytes per repo
   - fetch README text where available
   - extract framework and language signals from descriptions and READMEs

3. Evidence scoring:
   - `SUPPORTED`: repeated project evidence or substantial language bytes
   - `STRETCHED`: weak evidence, one small repo, README-only mention, or stale repo
   - `NO_PUBLIC_GITHUB_EVIDENCE`: no public match; never call this a lie

4. VERDICT integration later:
   - add an Investigator mode toggle
   - add a backend service that converts OSINT findings into Evidence Document B
   - run the normal audit engine against CV claims
   - show sources beside every OSINT verdict

## Current Prototype

Run:

```powershell
python tools/osint_candidate_check.py --input tools/osint-candidate.sample.json --out-json osint-report.json --out-md osint-report.md --max-repos 20
```

Optional free GitHub token:

```powershell
$env:GITHUB_TOKEN = "github_pat_..."
python tools/osint_candidate_check.py --input candidate.json
```

The token is optional for small tests, but authenticated GitHub requests have
much more practical rate limits than anonymous calls.

## Senior Advice

Keep this as evidence enrichment, not as final judgment.

- Never say "candidate lied" from missing GitHub evidence.
- Preserve exact source URLs and timestamps.
- Cache results per GitHub username for demo stability.
- Put rate limits and failures in the report instead of hiding them.
- Make every external check opt-in and visible to the user.
- Do not automate LinkedIn browser sessions, login scraping, or contact export.
- For the hackathon demo, use 2-3 prepared candidates with known public GitHub
  profiles and pasted LinkedIn/CV skill text.
