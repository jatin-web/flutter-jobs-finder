#!/usr/bin/env python3
"""
Greenhouse/Lever Fetcher
------------------------
Pulls Flutter-relevant jobs from companies' own Greenhouse/Lever ATS APIs.
This file does ONE job: fetch, normalize, write a raw snapshot. It knows
nothing about other sources, dedup, location filtering, or diffing --
that all happens in merge_and_filter.py. This isolation is the whole
point: adding/removing/breaking another source never touches this file.

Output:
    raw_greenhouse_lever.json -- every Flutter-relevant job currently live
    on the configured company boards, in the common schema:
        {source, company, title, location, url, posted_date, job_id}

Run this independently, on whatever schedule makes sense for it (no rate
limit on these APIs, so every 6 hours is reasonable).
"""

import json
import re
import time
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# CONFIG -- seed list of companies to check
# ---------------------------------------------------------------------------
# `slug` is the identifier in the company's careers URL. See README for how
# to find/verify more slugs (site:boards.greenhouse.io flutter, etc.)

GREENHOUSE_COMPANIES = [
    "truecaller",
    "inthepocket",
    "springhealth66",
    "embrace",
    "upwork",
    "moniepoint",
    "hs",  # Headspace
    "projectaservicesgmbhcokg",
]

LEVER_COMPANIES = [
    "paytm",
    "SKIMS",
    "idt",
    "jobgether",  # staffing agency, posts many client roles
    "scale3c",
]

FLUTTER_KEYWORDS = re.compile(r"\bflutter\b|\bdart\b", re.IGNORECASE)
HEADERS = {"User-Agent": "flutter-job-finder/2.0 (personal project)"}
REQUEST_TIMEOUT = 15
SLEEP_BETWEEN_REQUESTS = 0.4

OUT_DIR = Path(__file__).parent.parent
RAW_OUTPUT_FILE = OUT_DIR / "raw_greenhouse_lever.json"


def fetch_greenhouse(company_slug: str) -> list[dict]:
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
        content = job.get("content", "")
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


def main():
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

    RAW_OUTPUT_FILE.write_text(json.dumps(all_jobs, indent=2))
    print(f"\nWrote {len(all_jobs)} job(s) to {RAW_OUTPUT_FILE}")


if __name__ == "__main__":
    main()
