const SOURCE_STYLES = {
  greenhouse: {
    label: 'Greenhouse',
    className: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  },
  lever: {
    label: 'Lever',
    className: 'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400',
  },
  adzuna: {
    label: 'Adzuna',
    className: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  },
}

function timeAgo(dateStr) {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ''
  const diffH = Math.round((Date.now() - date.getTime()) / 36e5)
  if (diffH < 1) return 'just now'
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `${diffD}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function JobCard({ job, isNew }) {
  const sourceStyle =
    SOURCE_STYLES[job.source] ?? {
      label: job.source,
      className: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
    }

  return (
    <a
      href={job.url}
      target="_blank"
      rel="noreferrer"
      className="group relative flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700"
    >
      {isNew && (
        <span className="absolute -top-2 -right-2 rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md shadow-sky-500/30">
          NEW
        </span>
      )}
      <h3 className="pr-6 text-base font-semibold leading-snug text-slate-900 group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400">
        {job.title.trim()}
      </h3>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{job.company}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs">
        <span className={`rounded-full px-2 py-1 font-medium ring-1 ring-inset ${sourceStyle.className}`}>
          {sourceStyle.label}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {job.location}
        </span>
        <span className="ml-auto shrink-0 text-slate-400 dark:text-slate-500">{timeAgo(job.posted_date)}</span>
      </div>
    </a>
  )
}
