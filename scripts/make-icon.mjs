// Rasterize resources/icon.html -> resources/icon.png (1024x1024) using
// Electron's bundled Chromium, then the shell wrapper builds icon.icns.
import { _electron as electron } from 'playwright-core'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'

const APP_DIR = path.resolve(import.meta.dirname, '..')
const electronBin =
  process.platform === 'darwin'
    ? path.join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
    : path.join(APP_DIR, 'node_modules/electron/dist/electron')

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'koe-icon-'))
const app = await electron.launch({
  executablePath: electronBin,
  args: ['--no-sandbox', APP_DIR],
  env: { ...process.env, KOH_USER_DATA: userData },
  timeout: 30_000
})
const page = await app.firstWindow()
await page.goto('file://' + path.join(APP_DIR, 'resources/icon.html'))
const svg = await page.waitForSelector('#icon', { timeout: 10_000 })
await svg.screenshot({ path: path.join(APP_DIR, 'resources/icon.png'), omitBackground: true })
console.log('wrote resources/icon.png')
await app.close()
