import profilePhoto from './assets/profile.png'

const LINKS = {
  linkedin: 'https://www.linkedin.com/in/jatin-saini-ba12261b6/',
  github: 'https://github.com/jatin-web',
  email: 'jatinsaini1029@gmail.com',
}

function LinkedInIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  )
}

function GitHubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.58 2 12.19c0 4.49 2.87 8.3 6.84 9.64.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.61-3.37-1.21-3.37-1.21-.46-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.04 1.53 1.04.89 1.55 2.34 1.1 2.91.84.09-.66.35-1.1.63-1.36-2.22-.26-4.56-1.13-4.56-5.03 0-1.11.39-2.02 1.03-2.73-.1-.26-.45-1.31.1-2.72 0 0 .84-.27 2.75 1.04a9.3 9.3 0 0 1 5 0c1.91-1.31 2.75-1.04 2.75-1.04.55 1.41.2 2.46.1 2.72.64.71 1.03 1.62 1.03 2.73 0 3.91-2.34 4.77-4.57 5.02.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.2 10.2 0 0 0 22 12.19C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  )
}

function MailIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LinkPill({ href, icon, label, external }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-sky-100 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-sky-900/40 dark:hover:text-sky-400"
    >
      {icon}
      {label}
    </a>
  )
}

export default function Footer({ mostRecentPosted }) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200/70 bg-white/70 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="flex items-center gap-5">
            <img
              src={profilePhoto}
              alt="Jatin Saini"
              className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-md dark:ring-slate-900"
            />
            <div className="text-left">
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Jatin Saini</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Flutter Developer</p>
              <a
                href={`mailto:${LINKS.email}`}
                className="mt-1.5 flex items-center gap-2 text-sm text-slate-500 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
              >
                <MailIcon className="h-4 w-4" />
                {LINKS.email}
              </a>
              <div className="mt-3 flex flex-wrap gap-3">
                <LinkPill
                  href={LINKS.linkedin}
                  label="LinkedIn"
                  icon={<LinkedInIcon className="h-4 w-4" />}
                  external
                />
                <LinkPill href={LINKS.github} label="GitHub" icon={<GitHubIcon className="h-4 w-4" />} external />
              </div>
            </div>
          </div>

          <div className="max-w-sm text-center sm:text-right">
            <h2 className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-lg font-extrabold tracking-tight text-transparent dark:from-sky-400 dark:to-indigo-400">
              Flutter Jobs India
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Flutter &amp; Dart developer roles aggregated from Greenhouse, Lever &amp; Adzuna, refreshed
              automatically every 6 hours.
            </p>
            {mostRecentPosted && (
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-600">
                Newest listing posted {mostRecentPosted}
              </p>
            )}
          </div>
        </div>

        <div className="mt-12 border-t border-slate-200/70 pt-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-600">
          © {year} Jatin Saini. Built with React &amp; Tailwind CSS.
        </div>
      </div>
    </footer>
  )
}
