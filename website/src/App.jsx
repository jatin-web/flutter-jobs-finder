import { useEffect, useMemo, useState } from 'react'
import JobCard from './JobCard.jsx'

const SOURCES = ['all', 'greenhouse', 'lever', 'adzuna']

function useJobsData() {
  const [state, setState] = useState({ loading: true, error: null, jobs: [], newIds: new Set(), meta: null })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const base = import.meta.env.BASE_URL
        const [jobsRes, newlyRes, metaRes] = await Promise.all([
          fetch(`${base}data/jobs.json`),
          fetch(`${base}data/newly_posted.json`),
          fetch(`${base}data/meta.json`),
        ])
        const [jobs, newly, meta] = await Promise.all([jobsRes.json(), newlyRes.json(), metaRes.json()])
        if (cancelled) return
        const newIds = new Set(newly.map((j) => j.url))
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

  const generatedAt = meta?.generatedAt
    ? new Date(meta.generatedAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/70 sticky top-0 z-10">
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
            <div className="flex gap-2 text-center">
              <Stat label="Active" value={meta?.totalCount ?? '—'} />
              <Stat label="New" value={meta?.newCount ?? '—'} accent />
              <Stat label="Closed" value={meta?.closedCount ?? '—'} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, company, or location..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-sky-900/40"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-sky-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="newest">Newest first</option>
            <option value="company">Company A–Z</option>
          </select>
        </div>

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

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-xs text-slate-400 dark:text-slate-600 sm:px-6">
        {generatedAt ? `Last updated ${generatedAt}` : ''}
      </footer>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="min-w-[64px] rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className={`text-lg font-bold ${accent ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white'}`}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
    </div>
  )
}
