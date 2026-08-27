// Post-build prerender step: serves the built dist/ folder, loads it in a
// real headless browser, waits for the app's runtime fetch() calls to
// resolve and React to render the job list, then captures the fully
// rendered HTML and writes it back over dist/index.html.
//
// This is what react-snap does, but react-snap's bundled Chromium (via a
// long-abandoned puppeteer@1.x) fails to even launch on current systems --
// so this uses Playwright (actively maintained) directly instead. The app
// itself needs no changes: React's createRoot() on the client simply
// replaces this static markup once the JS bundle takes over, so crawlers
// (and anyone viewing source / with JS disabled) see real content
// immediately, while normal browsers still get the live, always-fresh
// client-rendered experience.
import { preview } from 'vite'
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html')

const server = await preview({ root: ROOT, preview: { port: 4444, strictPort: true } })
const url = server.resolvedUrls.local[0]

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  // Let React flush its post-fetch re-render before we snapshot the DOM.
  await page.waitForTimeout(500)

  const html = await page.content()
  const jobLinkCount = (html.match(/class="group relative flex flex-col/g) || []).length

  if (jobLinkCount === 0) {
    throw new Error('Prerender produced no job cards -- refusing to overwrite dist/index.html with empty content')
  }

  writeFileSync(DIST_INDEX, html)
  console.log(`Prerendered dist/index.html with ${jobLinkCount} job cards baked into the raw HTML.`)
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
