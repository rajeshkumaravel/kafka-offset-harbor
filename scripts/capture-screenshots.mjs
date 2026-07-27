// Capture README screenshots from the built app against the built-in demo
// cluster. Run after `npx electron-vite build`, output -> docs/images/.
import { _electron as electron } from 'playwright-core'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'

const APP = path.resolve(import.meta.dirname, '..')
const OUT = path.join(APP, 'docs/images')
fs.mkdirSync(OUT, { recursive: true })

const bin = path.join(APP, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'koh-shots-'))

const app = await electron.launch({
  executablePath: bin,
  args: ['--no-sandbox', APP],
  env: { ...process.env, KOH_USER_DATA: userData },
  timeout: 30_000
})
const page = await app.firstWindow()
await page.waitForSelector('.app', { timeout: 20_000 })
await page.waitForTimeout(800)

// 0) welcome screen
await page.screenshot({ path: path.join(OUT, 'welcome.png') })
console.log('wrote docs/images/welcome.png')

// leave the welcome screen into the demo cluster
await page.click('.welcome-btn >> text=Explore the demo cluster')
await page.waitForTimeout(1200)

// 1) message browser + inspector
await page.click('.tree-item >> text=orders.created')
await page.waitForSelector('.grid-row', { timeout: 15_000 })
await page.waitForTimeout(600)
await page.click('.grid-row')
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(OUT, 'messages.png') })
console.log('wrote docs/images/messages.png')

// 2) consumer group lag
await page.click('.tree-item >> text=analytics-pipeline')
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(OUT, 'consumer-lag.png') })
console.log('wrote docs/images/consumer-lag.png')

await app.close()
