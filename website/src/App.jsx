import { useEffect, useMemo, useState } from 'react'
import JobCard from './JobCard.jsx'
import Footer from './Footer.jsx'

const SOURCES = ['all', 'greenhouse', 'lever', 'adzuna']

// In prod the deployed site fetches straight from GitHub, so new job data
// shows up the instant the cron job commits -- no rebuild/redeploy needed.
// Data lives on the `job-data` branch (bot-only commits from the cron job),
// kept separate from `main` (code) so the commit history stays clean.
// In dev we use the local copies synced from ../output/ (see scripts/sync-data.mjs)
// so `npm run dev` works before anything's pushed.
const RAW_BASE = 'https://raw.githubusercontent.com/jatin-web/flutter-jobs-finder/job-data/output/'
const DATA_URLS = import.meta.env.DEV
  ? {
      jobs: `${import.meta.env.BASE_URL}data/jobs.json`,
      newly: `${import.meta.env.BASE_URL}data/newly_posted.json`,
      closed: `${import.meta.env.BASE_URL}data/closed_since_last_run.json`,
    }
  : {
      jobs: `${RAW_BASE}flutter_jobs_latest.json`,
      newly: `${RAW_BASE}newly_posted.json`,
      closed: `${RAW_BASE}closed_since_last_run.json`,
    }

const COMMITS_API =
  'https://api.github.com/repos/jatin-web/flutter-jobs-finder/commits?sha=job-data&path=output&per_page=1'

// "New" / "Closed" are diffed against whatever was last committed to the
// job-data branch -- and that only happens when the job set actually
// changes, not on a fixed schedule. So we fetch the real commit timestamp
// rather than claiming a fixed interval (e.g. "last 6 hours") that would
// often be wrong.
function useDataFreshness() {
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(COMMITS_API)
      .then((res) => res.json())
      .then((commits) => {
        if (cancelled) return
        const date = commits?.[0]?.commit?.author?.date
        if (date) setUpdatedAt(new Date(date))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return updatedAt
}

function useJobsData() {
  const [state, setState] = useState({ loading: true, error: null, jobs: [], newIds: new Set(), meta: null })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [jobsRes, newlyRes, closedRes] = await Promise.all([
          fetch(DATA_URLS.jobs),
          fetch(DATA_URLS.newly),
          fetch(DATA_URLS.closed),
        ])
        const [jobs, newly, closed] = await Promise.all([jobsRes.json(), newlyRes.json(), closedRes.json()])
        if (cancelled) return
        const newIds = new Set(newly.map((j) => j.url))
        const meta = {
          totalCount: jobs.length,
          newCount: newly.length,
          closedCount: closed.length,
        }
        setState({ loading: false, error: null, jobs, newIds, meta })
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: err.message }))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

export default function App() {
  const { loading, error, jobs, newIds, meta } = useJobsData()
  const dataUpdatedAt = useDataFreshness()
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let result = jobs.filter((job) => {
      if (source !== 'all' && job.source !== source) return false
      if (!q) return true
      return (
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q)
      )
    })
    result = [...result].sort((a, b) => {
      if (sortBy === 'company') return a.company.localeCompare(b.company)
      return new Date(b.posted_date) - new Date(a.posted_date)
    })
    return result
  }, [jobs, query, source, sortBy])

  const dataUpdatedAtLabel = dataUpdatedAt
    ? dataUpdatedAt.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  return (
    <>
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <header>
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent dark:from-sky-400 dark:to-indigo-400 sm:text-3xl">
                Flutter Jobs India
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Flutter &amp; Dart developer roles, aggregated from Greenhouse, Lever &amp; Adzuna.
              </p>
            </div>
            <div>
              <div className="grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white text-center dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                <Stat label="Active" value={meta?.totalCount ?? '—'} />
                <Stat
                  label="New"
                  value={meta?.newCount ?? '—'}
                  accent
                  pulse
                  title={
                    dataUpdatedAtLabel
                      ? `Added since data was last refreshed on ${dataUpdatedAtLabel}`
                      : 'Added since the last data refresh'
                  }
                />
                <Stat
                  label="Closed"
                  value={meta?.closedCount ?? '—'}
                  title={
                    dataUpdatedAtLabel
                      ? `No longer listed as of the last refresh, on ${dataUpdatedAtLabel}`
                      : 'No longer listed as of the last data refresh'
                  }
                />
              </div>
              {dataUpdatedAtLabel && (
                <p className="mt-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500 sm:text-right">
                  New/closed since data refreshed {dataUpdatedAtLabel}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, company, or location..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-sky-900/40"
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-700 shadow-sm outline-none focus:border-sky-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="newest">Newest first</option>
              <option value="company">Company A–Z</option>
            </select>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            >
              <path d="m5 7.5 5 5 5-5" />
            </svg>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition ${
                source === s
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            Couldn't load job data: {error}
          </p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No jobs match your filters.
          </p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Showing {filtered.length} of {jobs.length} jobs
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((job) => (
                <JobCard key={job.url || `${job.source}-${job.job_id}`} job={job} isNew={newIds.has(job.url)} />
              ))}
            </div>
          </>
        )}

      </main>
    </div>
    <Footer />
    </>
  )
}

function Stat({ label, value, accent, pulse, title }) {
  return (
    <div className="min-w-[64px] px-3 py-2" title={title}>
      <div className={`flex items-center justify-center gap-1.5 text-lg font-bold ${accent ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white'}`}>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
          </span>
        )}
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
    </div>
  )
}
