#!/usr/bin/env python3
"""
Public candidate-skill evidence collector for VERDICT investigator mode.

This prototype intentionally avoids LinkedIn scraping. Give it skills from a CV,
LinkedIn export, or manually copied public profile text, and it checks public
GitHub evidence for matching languages and project signals.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


KNOWN_SKILLS = {
    "java": ["java", "spring", "spring boot", "maven", "gradle"],
    "python": ["python", "django", "flask", "fastapi", "pandas"],
    "javascript": ["javascript", "js", "node", "node.js", "react", "vue", "angular"],
    "typescript": ["typescript", "ts", "react", "next.js", "nestjs"],
    "go": ["go", "golang"],
    "c#": ["c#", ".net", "dotnet", "asp.net"],
    "c++": ["c++", "cpp"],
    "c": [" c ", "c programming"],
    "php": ["php", "laravel", "symfony"],
    "ruby": ["ruby", "rails"],
    "kotlin": ["kotlin", "android"],
    "swift": ["swift", "ios"],
    "rust": ["rust"],
    "sql": ["sql", "postgres", "postgresql", "mysql", "sqlite", "oracle"],
    "html": ["html"],
    "css": ["css", "sass", "scss", "tailwind"],
    "docker": ["docker", "dockerfile", "compose"],
    "kubernetes": ["kubernetes", "k8s", "helm"],
}


@dataclass(frozen=True)
class CandidateInput:
    github_username: str
    claimed_skills: list[str]
    linkedin_text: str


class GitHubClient:
    def __init__(self, token: str | None = None, delay_seconds: float = 0.2) -> None:
        self.token = token
        self.delay_seconds = delay_seconds
        self.last_request = 0.0

    def get_json(self, path: str) -> Any:
        url = path if path.startswith("https://") else f"https://api.github.com{path}"
        body = self._request(url, accept="application/vnd.github+json")
        return json.loads(body.decode("utf-8"))

    def get_text(self, url: str) -> str:
        body = self._request(url, accept="text/plain")
        return body.decode("utf-8", errors="replace")

    def _request(self, url: str, accept: str) -> bytes:
        elapsed = time.monotonic() - self.last_request
        if elapsed < self.delay_seconds:
            time.sleep(self.delay_seconds - elapsed)
        headers = {
            "Accept": accept,
            "User-Agent": "verdict-osint-prototype/0.1",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = Request(url, headers=headers)
        try:
            with urlopen(request, timeout=20) as response:
                self.last_request = time.monotonic()
                return response.read()
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"GitHub request failed {exc.code} for {url}: {detail}") from exc
        except URLError as exc:
            raise RuntimeError(f"GitHub request failed for {url}: {exc.reason}") from exc


def normalize_skill(value: str) -> str:
    cleaned = value.strip().lower()
    aliases = {
        "node.js": "javascript",
        "nodejs": "javascript",
        "js": "javascript",
        "ts": "typescript",
        "golang": "go",
        "postgresql": "sql",
        "postgres": "sql",
        "mysql": "sql",
        "spring boot": "java",
        "spring": "java",
        "react": "javascript",
        "next.js": "typescript",
        "dotnet": "c#",
        ".net": "c#",
        "cpp": "c++",
        "k8s": "kubernetes",
    }
    return aliases.get(cleaned, cleaned)


def extract_skills_from_text(text: str) -> list[str]:
    lowered = f" {text.lower()} "
    found: set[str] = set()
    for canonical, needles in KNOWN_SKILLS.items():
        for needle in needles:
            pattern = re.escape(needle.lower())
            if re.search(rf"(?<![a-z0-9+#.]){pattern}(?![a-z0-9+#.])", lowered):
                found.add(canonical)
                break
    return sorted(found)


def load_input(path: Path) -> CandidateInput:
    data = json.loads(path.read_text(encoding="utf-8"))
    github_username = str(data.get("github_username", "")).strip()
    if not github_username:
        raise ValueError("candidate input requires github_username")
    claimed = [normalize_skill(str(item)) for item in data.get("claimed_skills", []) if str(item).strip()]
    linkedin_text = str(data.get("linkedin_text", ""))
    merged_claims = sorted(set(claimed + extract_skills_from_text(linkedin_text)))
    return CandidateInput(github_username=github_username, claimed_skills=merged_claims, linkedin_text=linkedin_text)


def fetch_repos(client: GitHubClient, username: str, max_repos: int) -> list[dict[str, Any]]:
    repos: list[dict[str, Any]] = []
    page = 1
    while len(repos) < max_repos:
        batch = client.get_json(
            f"/users/{quote(username)}/repos?type=owner&sort=updated&per_page=100&page={page}"
        )
        if not batch:
            break
        repos.extend(repo for repo in batch if not repo.get("fork"))
        page += 1
        if len(batch) < 100:
            break
    return repos[:max_repos]


def fetch_repo_languages(client: GitHubClient, repo: dict[str, Any]) -> dict[str, int]:
    return client.get_json(repo["languages_url"])


def fetch_readme(client: GitHubClient, repo: dict[str, Any]) -> str:
    default_branch = repo.get("default_branch") or "main"
    full_name = repo["full_name"]
    candidates = ["README.md", "readme.md", "README.txt", "README"]
    for name in candidates:
        url = f"https://raw.githubusercontent.com/{full_name}/{default_branch}/{name}"
        try:
            return client.get_text(url)
        except RuntimeError:
            continue
    return ""


def collect_github_evidence(client: GitHubClient, candidate: CandidateInput, max_repos: int) -> dict[str, Any]:
    repos = fetch_repos(client, candidate.github_username, max_repos)
    projects: list[dict[str, Any]] = []
    language_totals: dict[str, int] = {}

    for repo in repos:
        languages = fetch_repo_languages(client, repo)
        for language, bytes_count in languages.items():
            key = normalize_skill(language)
            language_totals[key] = language_totals.get(key, 0) + int(bytes_count)

        readme = fetch_readme(client, repo)
        text_signals = sorted(set(extract_skills_from_text(readme + " " + (repo.get("description") or ""))))
        repo_language_skills = sorted({normalize_skill(language) for language in languages})
        matched_claims = sorted(set(candidate.claimed_skills).intersection(repo_language_skills + text_signals))

        projects.append(
            {
                "name": repo["name"],
                "url": repo["html_url"],
                "description": repo.get("description"),
                "updated_at": repo.get("updated_at"),
                "stars": repo.get("stargazers_count", 0),
                "forks": repo.get("forks_count", 0),
                "languages": languages,
                "readme_skill_signals": text_signals,
                "matched_claimed_skills": matched_claims,
            }
        )

    return {
        "profile": f"https://github.com/{candidate.github_username}",
        "repo_count_checked": len(projects),
        "language_totals": dict(sorted(language_totals.items(), key=lambda item: item[1], reverse=True)),
        "projects": projects,
    }


def assess_claims(claimed_skills: list[str], github: dict[str, Any]) -> list[dict[str, Any]]:
    language_totals = github["language_totals"]
    projects = github["projects"]
    assessments: list[dict[str, Any]] = []
    for skill in claimed_skills:
        matched_projects = [project for project in projects if skill in project["matched_claimed_skills"]]
        language_bytes = language_totals.get(skill, 0)
        if language_bytes > 100_000 or len(matched_projects) >= 2:
            status = "SUPPORTED"
            confidence = "MEDIUM"
            reason = "Public GitHub repositories contain direct language evidence or multiple project matches."
        elif language_bytes > 0 or matched_projects:
            status = "STRETCHED"
            confidence = "MEDIUM"
            reason = "There is some public GitHub evidence, but it is thin for a strong experience claim."
        else:
            status = "NO_PUBLIC_GITHUB_EVIDENCE"
            confidence = "LOW"
            reason = "No checked public GitHub repository showed this skill. This is not proof the claim is false."
        assessments.append(
            {
                "skill": skill,
                "status": status,
                "confidence": confidence,
                "language_bytes": language_bytes,
                "matching_projects": [
                    {
                        "name": project["name"],
                        "url": project["url"],
                        "updated_at": project["updated_at"],
                    }
                    for project in matched_projects[:5]
                ],
                "reason": reason,
            }
        )
    return assessments


def build_report(candidate: CandidateInput, github: dict[str, Any]) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": {
            "policy": "Uses GitHub public API plus user-provided LinkedIn/CV text only. Does not scrape LinkedIn.",
            "github_username": candidate.github_username,
        },
        "claimed_skills": candidate.claimed_skills,
        "github": github,
        "skill_assessments": assess_claims(candidate.claimed_skills, github),
    }


def write_markdown(report: dict[str, Any], path: Path) -> None:
    lines = [
        "# OSINT Candidate Skill Evidence",
        "",
        f"Generated: {report['generated_at']}",
        f"GitHub: {report['github']['profile']}",
        "",
        "## Scope",
        report["scope"]["policy"],
        "",
        "## Skill Assessments",
        "",
    ]
    for item in report["skill_assessments"]:
        lines.append(f"### {item['skill']} - {item['status']}")
        lines.append(f"Confidence: {item['confidence']}")
        lines.append(f"Reason: {item['reason']}")
        lines.append(f"GitHub language bytes: {item['language_bytes']}")
        if item["matching_projects"]:
            lines.append("Matching projects:")
            for project in item["matching_projects"]:
                lines.append(f"- [{project['name']}]({project['url']}) updated {project['updated_at']}")
        else:
            lines.append("Matching projects: none in checked public repositories")
        lines.append("")

    lines.extend(["## Checked Projects", ""])
    for project in report["github"]["projects"]:
        matched = ", ".join(project["matched_claimed_skills"]) or "none"
        languages = ", ".join(project["languages"].keys()) or "none"
        lines.append(f"- [{project['name']}]({project['url']})")
        lines.append(f"  - Matched claimed skills: {matched}")
        lines.append(f"  - GitHub languages: {languages}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check public GitHub evidence for claimed candidate skills.")
    parser.add_argument("--input", required=True, type=Path, help="JSON file with github_username, claimed_skills, linkedin_text.")
    parser.add_argument("--out-json", type=Path, default=Path("osint-report.json"))
    parser.add_argument("--out-md", type=Path, default=Path("osint-report.md"))
    parser.add_argument("--max-repos", type=int, default=30)
    parser.add_argument("--github-token", default=os.getenv("GITHUB_TOKEN"), help="Optional token. Defaults to GITHUB_TOKEN env var.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    candidate = load_input(args.input)
    client = GitHubClient(token=args.github_token)
    github = collect_github_evidence(client, candidate, max_repos=args.max_repos)
    report = build_report(candidate, github)
    args.out_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_markdown(report, args.out_md)
    print(f"Wrote {args.out_json}")
    print(f"Wrote {args.out_md}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
