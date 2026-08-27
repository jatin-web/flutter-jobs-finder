import { useEffect, useRef, useState } from 'react'
import profilePhoto from './assets/profile.png'

const LINKS = {
  linkedin: 'https://www.linkedin.com/in/jatin-saini-ba12261b6/',
  github: 'https://github.com/jatin-web',
  email: 'jatinsaini1029@gmail.com',
}

// { cmd: what's "typed" at the $ prompt, out: the response line(s) below it }
const SCRIPT = [
  { cmd: 'whoami', out: ['Jatin Saini — Flutter Developer'] },
  { cmd: 'cat status.txt', out: ['Built this entire job board solo.', 'Open to opportunities \u{1F680}'] },
]

function useTerminalScript(active) {
  const [lines, setLines] = useState([])
  const [typing, setTyping] = useState('')
  const timeouts = useRef([])

  useEffect(() => {
    timeouts.current.forEach(clearTimeout)
    timeouts.current = []
    if (!active) {
      setLines([])
      setTyping('')
      return
    }

    const schedule = (fn, delay) => {
      const id = setTimeout(fn, delay)
      timeouts.current.push(id)
      return id
    }

    let t = 300
    for (const step of SCRIPT) {
      for (let i = 1; i <= step.cmd.length; i++) {
        schedule(() => setTyping(step.cmd.slice(0, i)), t)
        t += 28
      }
      t += 250
      schedule(() => {
        setTyping('')
        setLines((prev) => [...prev, { cmd: step.cmd, out: step.out }])
      }, t)
      t += 200
    }

    return () => {
      timeouts.current.forEach(clearTimeout)
      timeouts.current = []
    }
  }, [active])

  return { lines, typing }
}

export default function DevBadge() {
  const [open, setOpen] = useState(false)
  const { lines, typing } = useTerminalScript(open)

  return (
    <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div className="dev-card-enter w-[calc(100vw-2rem)] max-w-xs origin-bottom-right overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-1 flex-1 truncate text-center text-xs text-slate-500">whoami.sh</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-slate-500 transition hover:text-slate-300"
            >
              ✕
            </button>
          </div>

          <div className="min-h-[168px] px-4 py-4 font-mono text-[13px] leading-relaxed">
            {lines.map((line, i) => (
              <div key={i} className="mb-2">
                <p className="text-emerald-400">
                  <span className="text-slate-500">$</span> {line.cmd}
                </p>
                {line.out.map((o, j) => (
                  <p key={j} className="text-slate-200">
                    {o}
                  </p>
                ))}
              </div>
            ))}
            {typing && (
              <p className="text-emerald-400">
                <span className="text-slate-500">$</span> {typing}
                <span className="terminal-cursor" />
              </p>
            )}
            {lines.length === SCRIPT.length && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                <a
                  href={LINKS.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-slate-800 px-3 py-1.5 font-sans text-xs font-medium text-slate-200 transition hover:bg-sky-900/60 hover:text-sky-300"
                >
                  LinkedIn
                </a>
                <a
                  href={LINKS.github}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-slate-800 px-3 py-1.5 font-sans text-xs font-medium text-slate-200 transition hover:bg-sky-900/60 hover:text-sky-300"
                >
                  GitHub
                </a>
                <a
                  href={`mailto:${LINKS.email}`}
                  className="rounded-full bg-slate-800 px-3 py-1.5 font-sans text-xs font-medium text-slate-200 transition hover:bg-sky-900/60 hover:text-sky-300"
                >
                  Email
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Who built this site?"
        className="dev-cta flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:border-slate-900"
      >
        <img src={profilePhoto} alt="" className="h-full w-full rounded-full object-cover" />
      </button>
    </div>
  )
}
