#!/usr/bin/env python3
"""
Adzuna Fetcher
--------------
Pulls Flutter-relevant jobs from Adzuna's aggregator API (covers India --
LinkedIn/Indeed/Naukri-sourced listings that Greenhouse/Lever miss).
Same isolation principle as greenhouse_lever_fetcher.py: this file only
fetches + normalizes + writes a raw snapshot. No dedup, no location
filtering, no diffing -- that's merge_and_filter.py's job.

REQUIRES two environment variables (never hardcode these in the script):
    ADZUNA_APP_ID
    ADZUNA_APP_KEY

Set them before running, e.g. on Mac/Linux:
    export ADZUNA_APP_ID="your_app_id"
    export ADZUNA_APP_KEY="your_app_key"
    python3 fetchers/adzuna_fetcher.py

Output:
    raw_adzuna.json -- jobs in the same common schema as every other
    fetcher: {source, company, title, location, url, posted_date, job_id}

Free tier is ~1,000 calls/month. This script uses at most a handful of
calls per run (one per results page), so running it a few times a day
stays well within that.
"""

import json
import os
import re
import sys
import time
from pathlib import Path

import requests

PROJECT_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output"


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader -- sets os.environ from KEY=VALUE lines, without
    overriding anything already exported in the shell. Avoids pulling in
    python-dotenv for two variables."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv(PROJECT_ROOT / ".env")

APP_ID = os.environ.get("ADZUNA_APP_ID")
APP_KEY = os.environ.get("ADZUNA_APP_KEY")

COUNTRY_CODE = "in"  # Adzuna's country path segment for India
SEARCH_TERM = "flutter"
RESULTS_PER_PAGE = 50
MAX_PAGES = 3  # keeps a single run well within the free quota
MAX_DAYS_OLD = 30  # Adzuna's index keeps long-closed listings; without this
                    # a "flutter" search returns postings back to 2019 --
                    # exactly the staleness problem this project exists to avoid

FLUTTER_KEYWORDS = re.compile(r"\bflutter\b|\bdart\b", re.IGNORECASE)
REQUEST_TIMEOUT = 15
SLEEP_BETWEEN_REQUESTS = 0.5

RAW_OUTPUT_FILE = OUTPUT_DIR / "raw_adzuna.json"


def fetch_adzuna_page(page: int) -> list[dict]:
    url = f"https://api.adzuna.com/v1/api/jobs/{COUNTRY_CODE}/search/{page}"
    params = {
        "app_id": APP_ID,
        "app_key": APP_KEY,
        "what": SEARCH_TERM,
        "results_per_page": RESULTS_PER_PAGE,
        "max_days_old": MAX_DAYS_OLD,
        "sort_by": "date",
        "content-type": "application/json",
    }
    try:
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            print(f"  [adzuna] page {page}: HTTP {resp.status_code} -- {resp.text[:200]}")
            return []
        data = resp.json()
    except requests.RequestException as e:
        print(f"  [adzuna] page {page}: request failed ({e}), skipping")
        return []

    jobs = []
    for job in data.get("results", []):
        title = job.get("title", "")
        description = job.get("description", "")
        company = (job.get("company") or {}).get("display_name", "Unknown")
        title_match = FLUTTER_KEYWORDS.search(title)
        if not title_match and not FLUTTER_KEYWORDS.search(description):
            continue
        # "Flutter Entertainment" (a real UK gambling company) makes the
        # keyword search match every one of its job postings regardless of
        # role. If the only match is via description and the employer's own
        # name contains "flutter", it's almost certainly this collision.
        if not title_match and FLUTTER_KEYWORDS.search(company):
            continue
        location = (job.get("location") or {}).get("display_name", "Unknown")
        jobs.append({
            "source": "adzuna",
            "company": company,
            "title": title,
            "location": location,
            "url": job.get("redirect_url", ""),
            "posted_date": job.get("created", ""),
            "job_id": str(job.get("id", "")),
        })
    return jobs


def main():
    if not APP_ID or not APP_KEY:
        print("ERROR: ADZUNA_APP_ID and ADZUNA_APP_KEY must be set as environment variables.")
        print('Example: export ADZUNA_APP_ID="xxx" && export ADZUNA_APP_KEY="yyy"')
        sys.exit(1)

    all_jobs = []
    print("Fetching Adzuna (India, 'flutter')...")
    for page in range(1, MAX_PAGES + 1):
        page_jobs = fetch_adzuna_page(page)
        print(f"  [adzuna] page {page}: {len(page_jobs)} Flutter-relevant posting(s)")
        if not page_jobs:
            break  # no more results, stop paging
        all_jobs.extend(page_jobs)
        time.sleep(SLEEP_BETWEEN_REQUESTS)

    RAW_OUTPUT_FILE.write_text(json.dumps(all_jobs, indent=2))
    print(f"\nWrote {len(all_jobs)} job(s) to {RAW_OUTPUT_FILE}")


if __name__ == "__main__":
    main()
