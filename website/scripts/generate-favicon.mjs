// One-off generator for the PNG favicon set. Google recommends shipping PNG
// favicons alongside SVG (some of its crawlers don't reliably pick up
// SVG-only favicons), so this rasterizes public/favicon.svg at each standard
// size via Playwright, matching the approach used for the OG banner.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SVG_MARKUP = readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8')

const targets = [
  { size: 16, out: 'favicon-16x16.png' },
  { size: 32, out: 'favicon-32x32.png' },
  { size: 48, out: 'favicon-48x48.png' },
  { size: 180, out: 'apple-touch-icon.png' },
]

const browser = await chromium.launch()
try {
  for (const { size, out } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    // Inline the SVG markup directly -- loading it as an <img src="file://..."> from
    // a setContent() page (which runs in an about:blank context) does not reliably load.
    await page.setContent(
      `<!doctype html><html><head><style>*{margin:0;padding:0}html,body{width:100%;height:100%}svg{display:block;width:100%;height:100%}</style></head><body>${SVG_MARKUP}</body></html>`
    )
    const outPath = path.join(ROOT, 'public', out)
    await page.screenshot({ path: outPath })
    console.log(`Wrote public/${out} (${size}x${size})`)
    await page.close()
  }
} finally {
  await browser.close()
}
