// Dev-only: copies the pipeline's output/*.json into public/data/ so
// `npm run dev` has data to fetch locally, without needing a push to GitHub.
// (Production fetches directly from raw.githubusercontent.com at runtime --
// see src/App.jsx -- so this script's output is never bundled into a build.)
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUTPUT_DIR = path.join(REPO_ROOT, 'output')
const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data')

mkdirSync(DATA_DIR, { recursive: true })

const files = {
  'flutter_jobs_latest.json': 'jobs.json',
  'newly_posted.json': 'newly_posted.json',
  'closed_since_last_run.json': 'closed_since_last_run.json',
}

for (const [src, dest] of Object.entries(files)) {
  const srcPath = path.join(OUTPUT_DIR, src)
  const destPath = path.join(DATA_DIR, dest)
  if (!existsSync(srcPath)) {
    console.warn(`  (skipping ${src} -- not found)`)
    writeFileSync(destPath, '[]')
    continue
  }
  copyFileSync(srcPath, destPath)
  console.log(`  copied ${src} -> public/data/${dest}`)
}
