#!/usr/bin/env python3
"""
Flutter Job Finder
-------------------
Pulls LIVE job postings from companies' own ATS (Applicant Tracking System)
APIs -- Greenhouse and Lever -- instead of scraping LinkedIn/Indeed.

Why this fixes the "is this job still open?" problem:
Greenhouse/Lever APIs return exactly what's on the company's live careers
page. The moment a company closes a role, it disappears from the API too.
There is no staleness -- if it's in the response, it's open right now.

Usage:
    python3 find_flutter_jobs.py

Output:
    - flutter_jobs_latest.json   -> current snapshot of all matching jobs
    - flutter_jobs.csv           -> same data, spreadsheet-friendly
    - newly_posted.json          -> jobs that appeared since the last run
    - closed_since_last_run.json -> jobs that were open last run, now gone

Run this on a schedule (cron / GitHub Actions) and the new/closed diffs
become genuinely useful -- "show me what changed since yesterday."
"""

import json
import csv
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# 1. CONFIG -- seed list of companies to check
# ---------------------------------------------------------------------------
# `slug` is the identifier in the company's careers URL, e.g.
#   https://boards.greenhouse.io/robinhood        -> slug = "robinhood"
#   https://jobs.lever.co/netflix                  -> slug = "netflix"
#
# HOW TO FIND MORE SLUGS (do this to grow the list -- accuracy > guessing):
#   1. Go to a company's careers page, look for a "Powered by Greenhouse"
#      or "Powered by Lever" footer, or check if their apply links go to
#      boards.greenhouse.io/<slug> or jobs.lever.co/<slug>.
#   2. Google: site:boards.greenhouse.io flutter  (or site:jobs.lever.co flutter)
#      to find companies actively hiring Flutter devs right now.
#   3. Add the slug to the appropriate list below.
#
# The entries below are EXAMPLES to get you started -- verify each slug
# still resolves before relying on it (companies change ATS providers).

GREENHOUSE_COMPANIES = [
    "truecaller",       # verified via live posting, Aug 2026 (India-facing)
    "inthepocket",      # verified via live posting, Aug 2026
    "springhealth66",   # verified via live posting, Aug 2026
    "embrace",          # verified via live posting, Aug 2026
    "upwork",           # verified via live posting, Aug 2026
    "moniepoint",       # verified via live posting, Aug 2026
    "hs",                # Headspace -- verified via live posting, Aug 2026
    "projectaservicesgmbhcokg",  # verified via live posting, Aug 2026
]

LEVER_COMPANIES = [
    "paytm",     # verified via live posting, Aug 2026 (India)
    "SKIMS",     # verified via live posting, Aug 2026
    "idt",       # verified via live posting, Aug 2026
    "jobgether", # verified via live posting, Aug 2026 -- staffing agency, posts many client roles
    "scale3c",   # verified via live posting, Aug 2026
]

# Keywords used to decide whether a posting is "Flutter-relevant".
# Kept broad but excludes plain "mobile developer" postings that never
# mention Flutter/Dart, since those are usually native iOS/Android.
FLUTTER_KEYWORDS = re.compile(r"\bflutter\b|\bdart\b", re.IGNORECASE)

# ---------------------------------------------------------------------------
# LOCATION FILTER -- set to None for worldwide (no filtering), or a list of
# keywords to only keep jobs whose location string matches one of them.
# This is intentionally a single toggle: flip LOCATION_FILTER to None later
# to go worldwide without touching any other logic.
# ---------------------------------------------------------------------------
LOCATION_FILTER = [
    "india", "bangalore", "bengaluru", "mumbai", "delhi", "ncr", "gurgaon",
    "gurugram", "noida", "pune", "hyderabad", "chennai", "kolkata",
    "ahmedabad", "kochi", "cochin", "chandigarh", "jaipur",
]
# Note: this is a simple substring match on whatever location string the
# ATS gives us -- e.g. "Bengaluru, India" or "Remote - India" both match.
# It will NOT catch jobs the company tags only as "Remote" with no country
# (some India-open remote roles get missed this way) -- worth checking
# those manually until the filter is made smarter.

HEADERS = {"User-Agent": "flutter-job-finder/1.0 (personal project)"}
REQUEST_TIMEOUT = 15
SLEEP_BETWEEN_REQUESTS = 0.4  # be polite to the APIs

OUT_DIR = Path(__file__).parent
LATEST_FILE = OUT_DIR / "flutter_jobs_latest.json"     # filtered, user-facing
RAW_SNAPSHOT_FILE = OUT_DIR / "flutter_jobs_raw.json"  # unfiltered, diff-tracking only
CSV_FILE = OUT_DIR / "flutter_jobs.csv"
NEW_FILE = OUT_DIR / "newly_posted.json"
CLOSED_FILE = OUT_DIR / "closed_since_last_run.json"


# ---------------------------------------------------------------------------
# 2. FETCHERS -- one per ATS, each returns a normalized list of dicts
# ---------------------------------------------------------------------------

def fetch_greenhouse(company_slug: str) -> list[dict]:
    """Greenhouse's public board API. Docs: /v1/boards/{slug}/jobs"""
    url = f"https://boards-api.greenhouse.io/v1/boards/{company_slug}/jobs?content=true"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            print(f"  [greenhouse] {company_slug}: HTTP {resp.status_code}, skipping")
            return []
        data = resp.json()
    except requests.RequestException as e:
        print(f"  [greenhouse] {company_slug}: request failed ({e}), skipping")
        return []

    jobs = []
    for job in data.get("jobs", []):
        title = job.get("title", "")
        content = job.get("content", "")  # full HTML description
        if not FLUTTER_KEYWORDS.search(title) and not FLUTTER_KEYWORDS.search(content):
            continue
        location = (job.get("location") or {}).get("name", "Unknown")
        jobs.append({
            "source": "greenhouse",
            "company": company_slug,
            "title": title,
            "location": location,
            "url": job.get("absolute_url", ""),
            "posted_date": job.get("updated_at", ""),
            "job_id": str(job.get("id", "")),
        })
    return jobs


def fetch_lever(company_slug: str) -> list[dict]:
    """Lever's public postings API. Docs: /v0/postings/{slug}?mode=json"""
    url = f"https://api.lever.co/v0/postings/{company_slug}?mode=json"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            print(f"  [lever] {company_slug}: HTTP {resp.status_code}, skipping")
            return []
        data = resp.json()
    except requests.RequestException as e:
        print(f"  [lever] {company_slug}: request failed ({e}), skipping")
        return []

    jobs = []
    for job in data:
        title = job.get("text", "")
        desc = job.get("descriptionPlain", "") or job.get("description", "")
        if not FLUTTER_KEYWORDS.search(title) and not FLUTTER_KEYWORDS.search(desc):
            continue
        categories = job.get("categories", {}) or {}
        location = categories.get("location", "Unknown")
        jobs.append({
            "source": "lever",
            "company": company_slug,
            "title": title,
            "location": location,
            "url": job.get("hostedUrl", ""),
            "posted_date": str(job.get("createdAt", "")),
            "job_id": str(job.get("id", "")),
        })
    return jobs


# ---------------------------------------------------------------------------
# 3. RUN -- pull everything, dedupe, diff against last run, write outputs
# ---------------------------------------------------------------------------

def collect_all_jobs() -> list[dict]:
    all_jobs = []

    print("Fetching Greenhouse boards...")
    for slug in GREENHOUSE_COMPANIES:
        jobs = fetch_greenhouse(slug)
        if jobs:
            print(f"  [greenhouse] {slug}: {len(jobs)} Flutter-relevant posting(s)")
        all_jobs.extend(jobs)
        time.sleep(SLEEP_BETWEEN_REQUESTS)

    print("Fetching Lever boards...")
    for slug in LEVER_COMPANIES:
        jobs = fetch_lever(slug)
        if jobs:
            print(f"  [lever] {slug}: {len(jobs)} Flutter-relevant posting(s)")
        all_jobs.extend(jobs)
        time.sleep(SLEEP_BETWEEN_REQUESTS)

    return all_jobs


def apply_location_filter(jobs: list[dict], verbose: bool = True) -> list[dict]:
    """Keep only jobs matching LOCATION_FILTER keywords. No-op if None."""
    if LOCATION_FILTER is None:
        return jobs
    kept = []
    for job in jobs:
        loc = (job.get("location") or "").lower()
        if any(keyword in loc for keyword in LOCATION_FILTER):
            kept.append(job)
    dropped = len(jobs) - len(kept)
    if dropped and verbose:
        print(f"Location filter: kept {len(kept)}, dropped {dropped} (not India-tagged)")
    return kept


def job_key(job: dict) -> str:
    """Stable identifier for diffing between runs."""
    return f"{job['source']}:{job['company']}:{job['job_id']}"


def diff_against_previous(current_jobs: list[dict]) -> tuple[list[dict], list[dict]]:
    """Compare this run's RAW (unfiltered) jobs to the last saved RAW snapshot.
    Using the unfiltered set here means the diff reflects jobs actually
    opening/closing -- not artifacts of changing LOCATION_FILTER later.
    Returns (newly_posted, closed_since_last_run), both still unfiltered --
    callers should apply the location filter to these before displaying."""
    if not RAW_SNAPSHOT_FILE.exists():
        return current_jobs, []  # first run ever -- everything is "new"

    previous_jobs = json.loads(RAW_SNAPSHOT_FILE.read_text())
    prev_keys = {job_key(j): j for j in previous_jobs}
    curr_keys = {job_key(j): j for j in current_jobs}

    new_jobs = [j for k, j in curr_keys.items() if k not in prev_keys]
    closed_jobs = [j for k, j in prev_keys.items() if k not in curr_keys]
    return new_jobs, closed_jobs


def write_csv(jobs: list[dict]):
    if not jobs:
        return
    fieldnames = ["title", "company", "location", "source", "posted_date", "url"]
    with CSV_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(jobs)


def main():
    print(f"Run started: {datetime.now(timezone.utc).isoformat()}\n")

    current_jobs_raw = collect_all_jobs()
    new_jobs, closed_jobs = diff_against_previous(current_jobs_raw)

    # Save the RAW (unfiltered) snapshot for next run's diff to compare against.
    RAW_SNAPSHOT_FILE.write_text(json.dumps(current_jobs_raw, indent=2))

    # Everything shown to the user/written to the public files is filtered.
    current_jobs = apply_location_filter(current_jobs_raw)
    new_jobs = apply_location_filter(new_jobs, verbose=False)
    closed_jobs = apply_location_filter(closed_jobs, verbose=False)

    LATEST_FILE.write_text(json.dumps(current_jobs, indent=2))
    NEW_FILE.write_text(json.dumps(new_jobs, indent=2))
    CLOSED_FILE.write_text(json.dumps(closed_jobs, indent=2))
    write_csv(current_jobs)

    print(f"\nDone. {len(current_jobs)} active Flutter posting(s) found.")
    print(f"  {len(new_jobs)} newly posted since last run.")
    print(f"  {len(closed_jobs)} closed since last run.")
    print(f"\nFiles written to {OUT_DIR}/")


if __name__ == "__main__":
    main()