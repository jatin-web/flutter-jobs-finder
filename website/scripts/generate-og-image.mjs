// One-off generator for the static Open Graph preview image.
// Renders scripts/og-image-template.html (not part of the live React app)
// at exactly 1200x630 and screenshots it to public/og-image.png, which Vite
// copies verbatim into dist/ (and from there to the deployed site) on build.
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const TEMPLATE = path.join(ROOT, 'scripts', 'og-image-template.html')
const OUTPUT = path.join(ROOT, 'public', 'og-image.png')

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.goto(`file://${TEMPLATE}`)
  await page.waitForTimeout(200) // let the Google Font finish applying
  await page.screenshot({ path: OUTPUT })
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`)
} finally {
  await browser.close()
}
