// Copies the pipeline's output/*.json into public/data/ so the site can
// fetch them as static assets. Run automatically before dev/build.
import { existsSync, mkdirSync, copyFileSync, statSync, readFileSync, writeFileSync } from 'node:fs'
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

let generatedAt = null

for (const [src, dest] of Object.entries(files)) {
  const srcPath = path.join(OUTPUT_DIR, src)
  const destPath = path.join(DATA_DIR, dest)
  if (!existsSync(srcPath)) {
    console.warn(`  (skipping ${src} -- not found)`)
    writeFileSync(destPath, '[]')
    continue
  }
  copyFileSync(srcPath, destPath)
  const mtime = statSync(srcPath).mtime
  if (!generatedAt || mtime > generatedAt) generatedAt = mtime
  console.log(`  copied ${src} -> public/data/${dest}`)
}

const jobs = JSON.parse(readFileSync(path.join(DATA_DIR, 'jobs.json'), 'utf-8'))
const newly = JSON.parse(readFileSync(path.join(DATA_DIR, 'newly_posted.json'), 'utf-8'))
const closed = JSON.parse(readFileSync(path.join(DATA_DIR, 'closed_since_last_run.json'), 'utf-8'))

writeFileSync(
  path.join(DATA_DIR, 'meta.json'),
  JSON.stringify(
    {
      generatedAt: generatedAt ? generatedAt.toISOString() : null,
      totalCount: jobs.length,
      newCount: newly.length,
      closedCount: closed.length,
    },
    null,
    2,
  ),
)

console.log(`  meta: ${jobs.length} active, ${newly.length} new, ${closed.length} closed`)
