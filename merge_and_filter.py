#!/usr/bin/env python3
"""
Merge & Filter
--------------
The ONLY file that knows multiple sources exist. Reads whatever
raw_*.json snapshots are present (written independently by each
fetcher), dedupes across sources, diffs against the last merged
snapshot to find new/closed jobs, applies the location filter, and
writes the final user-facing files.

To add a new source later: write a new fetchers/<name>_fetcher.py that
outputs raw_<name>.json in the common schema, then add one line to
RAW_SOURCE_FILES below. Nothing else in this file needs to change, and
no other fetcher file needs to change either.

Run this AFTER running whichever fetchers you want included -- it does
not fetch anything itself, only combines what's already on disk.
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"

# ---------------------------------------------------------------------------
# Every raw snapshot file to merge. Add a line here when a new fetcher is
# added -- this is the one and only place that needs to know.
# ---------------------------------------------------------------------------
RAW_SOURCE_FILES = [
    OUTPUT_DIR / "raw_greenhouse_lever.json",
    OUTPUT_DIR / "raw_adzuna.json",
]

# When the same job appears from more than one source, prefer sources
# lower in this priority number -- ATS sources (Greenhouse/Lever) are
# authoritative on "is this still open", so they win over an aggregator.
SOURCE_PRIORITY = {"greenhouse": 0, "lever": 0, "adzuna": 1}

LOCATION_FILTER = [
    "india", "bangalore", "bengaluru", "mumbai", "delhi", "ncr", "gurgaon",
    "gurugram", "noida", "pune", "hyderabad", "chennai", "kolkata",
    "ahmedabad", "kochi", "cochin", "chandigarh", "jaipur",
]
# Set LOCATION_FILTER = None above to go worldwide -- nothing else changes.

MERGED_RAW_SNAPSHOT = OUTPUT_DIR / "merged_raw_snapshot.json"  # for diffing only
LATEST_FILE = OUTPUT_DIR / "flutter_jobs_latest.json"          # filtered, public
CSV_FILE = OUTPUT_DIR / "flutter_jobs.csv"
NEW_FILE = OUTPUT_DIR / "newly_posted.json"
CLOSED_FILE = OUTPUT_DIR / "closed_since_last_run.json"


def load_raw_sources() -> list[dict]:
    combined = []
    for path in RAW_SOURCE_FILES:
        if not path.exists():
            print(f"  (skipping {path.name} -- not found, that fetcher hasn't run yet)")
            continue
        jobs = json.loads(path.read_text())
        print(f"  {path.name}: {len(jobs)} job(s)")
        combined.extend(jobs)
    return combined


def dedupe(jobs: list[dict]) -> list[dict]:
    """Dedupe by URL first (exact same listing), then by normalized
    (company, title, location) to catch the same job posted via two
    different sources with different URLs. Location is included because
    staffing agencies (e.g. jobgether) post many distinct client roles
    under identical generic titles ("Senior Mobile Engineer (Flutter)")
    -- (company, title) alone collapsed 39 real, distinct postings down
    to 4. When a duplicate is found, keep whichever copy has the lower
    SOURCE_PRIORITY number."""
    jobs_sorted = sorted(jobs, key=lambda j: SOURCE_PRIORITY.get(j.get("source"), 99))
    seen_urls = set()
    seen_triples = set()
    result = []
    for job in jobs_sorted:
        url = job.get("url", "")
        triple = (
            job.get("company", "").strip().lower(),
            job.get("title", "").strip().lower(),
            job.get("location", "").strip().lower(),
        )
        if url and url in seen_urls:
            continue
        if triple in seen_triples:
            continue
        if url:
            seen_urls.add(url)
        seen_triples.add(triple)
        result.append(job)
    return result


def job_key(job: dict) -> str:
    return f"{job.get('source')}:{job.get('company')}:{job.get('job_id')}"


def diff_against_previous(current_jobs: list[dict]) -> tuple[list[dict], list[dict]]:
    if not MERGED_RAW_SNAPSHOT.exists():
        return current_jobs, []
    previous_jobs = json.loads(MERGED_RAW_SNAPSHOT.read_text())
    prev_keys = {job_key(j): j for j in previous_jobs}
    curr_keys = {job_key(j): j for j in current_jobs}
    new_jobs = [j for k, j in curr_keys.items() if k not in prev_keys]
    closed_jobs = [j for k, j in prev_keys.items() if k not in curr_keys]
    return new_jobs, closed_jobs


def apply_location_filter(jobs: list[dict], verbose: bool = True) -> list[dict]:
    if LOCATION_FILTER is None:
        return jobs
    kept = [j for j in jobs if any(kw in (j.get("location") or "").lower() for kw in LOCATION_FILTER)]
    dropped = len(jobs) - len(kept)
    if dropped and verbose:
        print(f"Location filter: kept {len(kept)}, dropped {dropped} (not India-tagged)")
    return kept


def write_csv(jobs: list[dict]):
    import csv
    if not jobs:
        return
    fieldnames = ["title", "company", "location", "source", "posted_date", "url"]
    with CSV_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(jobs)


def main():
    print("Loading raw snapshots from each fetcher...")
    all_jobs_raw = load_raw_sources()

    deduped_raw = dedupe(all_jobs_raw)
    dupes_removed = len(all_jobs_raw) - len(deduped_raw)
    if dupes_removed:
        print(f"Dedup: removed {dupes_removed} duplicate(s) across sources")

    new_jobs, closed_jobs = diff_against_previous(deduped_raw)
    MERGED_RAW_SNAPSHOT.write_text(json.dumps(deduped_raw, indent=2))

    current_jobs = apply_location_filter(deduped_raw)
    new_jobs = apply_location_filter(new_jobs, verbose=False)
    closed_jobs = apply_location_filter(closed_jobs, verbose=False)

    LATEST_FILE.write_text(json.dumps(current_jobs, indent=2))
    NEW_FILE.write_text(json.dumps(new_jobs, indent=2))
    CLOSED_FILE.write_text(json.dumps(closed_jobs, indent=2))
    write_csv(current_jobs)

    print(f"\nDone. {len(current_jobs)} active India-tagged Flutter posting(s).")
    print(f"  {len(new_jobs)} newly posted since last merge.")
    print(f"  {len(closed_jobs)} closed since last merge.")
    print(f"Files written to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
