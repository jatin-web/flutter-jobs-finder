# flutter-job-finder

A small Python pipeline that finds Flutter/Dart developer job postings in
India across multiple sources, dedupes them, and tracks what's newly
posted or closed between runs.

This is **not** a Flutter app — despite the name, it's a job-listing
scraper built in Python that happens to search for "Flutter" job postings.

## How it works

Each fetcher is independent and knows nothing about the others. It only
fetches from its source and writes a raw snapshot in a common schema:

```
{source, company, title, location, url, posted_date, job_id}
```

`merge_and_filter.py` is the only file that knows multiple sources exist.
It combines the raw snapshots, dedupes across sources, diffs against the
previous run to find new/closed postings, filters to India-based
locations, and writes the final output files.

```
fetchers/adzuna_fetcher.py              Adzuna aggregator API (India, "flutter")
fetchers/greenhouse_lever_fetcher.py    Per-company Greenhouse/Lever ATS boards
                    |
                    v
   output/raw_adzuna.json, output/raw_greenhouse_lever.json
                    |
                    v
            merge_and_filter.py   (dedupe, diff, location filter)
                    |
                    v
   output/flutter_jobs_latest.json / output/flutter_jobs.csv  <- current active listings
   output/newly_posted.json                                   <- new since last run
   output/closed_since_last_run.json                          <- gone since last run
   output/merged_raw_snapshot.json                            <- diff baseline for next run
```

All files under `output/` are generated and committed to git, so the
repo also serves as a running history of what was live at each run.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Adzuna requires an app ID and key (free tier, ~1,000 calls/month). Create
a `.env` file in the project root (gitignored, never commit it):

```
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
```

## Running

Activate the venv first (`source venv/bin/activate`), then run each
script individually with `python3`. All three scripts resolve their
file paths relative to their own location, so it doesn't matter which
directory you run them from as long as the venv is active.

### 1. `fetchers/greenhouse_lever_fetcher.py`

No API key needed — hits the public Greenhouse/Lever board APIs
directly for the companies listed in `GREENHOUSE_COMPANIES` /
`LEVER_COMPANIES`.

```bash
python3 fetchers/greenhouse_lever_fetcher.py
```

Writes `output/raw_greenhouse_lever.json`.

### 2. `fetchers/adzuna_fetcher.py`

Requires `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` — either exported in
your shell or set in a `.env` file in the project root (see Setup
above; the script loads `.env` itself, no extra tooling needed).

```bash
python3 fetchers/adzuna_fetcher.py
```

Writes `output/raw_adzuna.json`. Fails fast with an error message if
the credentials aren't set.

### 3. `merge_and_filter.py`

Doesn't fetch anything itself — only combines whatever raw snapshot
file(s) are already on disk under `output/`, so it can be run after
either fetcher, both, or neither (an empty run is harmless).

```bash
python3 merge_and_filter.py
```

Writes `output/flutter_jobs_latest.json`, `output/flutter_jobs.csv`,
`output/newly_posted.json`, `output/closed_since_last_run.json`, and
`output/merged_raw_snapshot.json` (the diff baseline for the next run).

### Typical full run

```bash
source venv/bin/activate
python3 fetchers/greenhouse_lever_fetcher.py
python3 fetchers/adzuna_fetcher.py
python3 merge_and_filter.py
```

## Adding a new source

1. Write `fetchers/<name>_fetcher.py` that outputs `output/raw_<name>.json`
   in the common schema above.
2. Add one line to `RAW_SOURCE_FILES` in `merge_and_filter.py`.

Nothing else needs to change, and no existing fetcher needs to change
either.

## Configuration

- **Location filter** (`merge_and_filter.py`): currently restricted to
  India-based cities. Set `LOCATION_FILTER = None` to go worldwide.
- **Companies tracked** (`greenhouse_lever_fetcher.py`):
  `GREENHOUSE_COMPANIES` and `LEVER_COMPANIES` lists — add a company's
  Greenhouse/Lever board slug to track it.
- **Source priority on duplicates** (`merge_and_filter.py`):
  `SOURCE_PRIORITY` — ATS sources (Greenhouse/Lever) are treated as
  authoritative over the Adzuna aggregator when the same job appears in
  both.
