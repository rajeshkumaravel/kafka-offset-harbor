// REPL driver for Kafka Offset Harbor. Drives the built app
// (out/) with Playwright. Run `node scripts/driver.mjs`, then type
// commands: launch, ss <name>, click <sel>, click-text <text>, eval <js>…
import { _electron as electron } from 'playwright-core'
import * as readline from 'node:readline'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const APP_DIR = path.resolve(import.meta.dirname, '..')
const SHOT_DIR = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), 'koe-shots')
fs.mkdirSync(SHOT_DIR, { recursive: true })

let app = null
let page = null

const electronBin =
  process.platform === 'darwin'
    ? path.join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
    : path.join(APP_DIR, 'node_modules/electron/dist/electron')

const COMMANDS = {
  async launch() {
    if (app) return console.log('already launched')
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'koe-data-'))
    app = await electron.launch({
      executablePath: electronBin,
      args: ['--no-sandbox', APP_DIR],
      env: { ...process.env, KOH_USER_DATA: userData },
      timeout: 30_000
    })
    page = await app.firstWindow()
    await page.waitForSelector('.app', { timeout: 20_000 })
    console.log('launched.', app.windows().length, 'window(s):', page.url())
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first')
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png')
    await page.screenshot({ path: f })
    console.log('screenshot:', f)
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first')
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return 'NOT_FOUND'
      el.click()
      return 'OK'
    }, sel)
    console.log('click', sel, '→', r)
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first')
    const r = await page.evaluate((t) => {
      const els = [...document.querySelectorAll('button, a, [role="button"], .tree-item, .tab, .profile-row, .grid-row, option')]
      const el = els.find((e) => e.textContent?.trim() === t) ?? els.find((e) => e.textContent?.includes(t))
      if (!el) return 'NOT_FOUND'
      el.click()
      return 'OK: ' + el.tagName + '.' + el.className
    }, text)
    console.log('click-text', JSON.stringify(text), '→', r)
  },

  async fill(arg) {
    if (!page) return console.log('ERROR: launch first')
    const sp = arg.indexOf(' ')
    const sel = arg.slice(0, sp)
    const value = arg.slice(sp + 1)
    try {
      await page.fill(sel, value)
      console.log('filled', sel)
    } catch (e) {
      console.log('ERROR:', e.message)
    }
  },

  async type(text) {
    if (page) await page.keyboard.type(text, { delay: 20 })
  },
  async press(key) {
    if (page) await page.keyboard.press(key)
  },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first')
    try {
      await page.waitForSelector(sel, { timeout: 15_000 })
      console.log('found:', sel)
    } catch {
      console.log('TIMEOUT:', sel)
    }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first')
    try {
      console.log(JSON.stringify(await page.evaluate(expr)))
    } catch (e) {
      console.log('ERROR:', e.message)
    }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first')
    console.log(
      await page.evaluate((s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)', sel || null)
    )
  },

  async quit() {
    if (app) await app.close().catch(() => {})
    app = null
    page = null
  },
  help() {
    console.log('commands:', Object.keys(COMMANDS).join(', '))
  }
}

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') })
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' })

rl.on('line', async (line) => {
  const trimmed = line.trim()
  const sp = trimmed.indexOf(' ')
  const cmd = sp === -1 ? trimmed : trimmed.slice(0, sp)
  const rest = sp === -1 ? '' : trimmed.slice(sp + 1)
  if (!cmd) return rl.prompt()
  const fn = COMMANDS[cmd]
  if (!fn) {
    console.log('unknown:', cmd, '— try: help')
    return rl.prompt()
  }
  try {
    await fn(rest)
  } catch (e) {
    console.log('ERROR:', e.message)
  }
  if (cmd === 'quit') {
    rl.close()
    process.exit(0)
  }
  rl.prompt()
})
rl.on('close', async () => {
  await COMMANDS.quit()
  process.exit(0)
})

console.log('koe driver — "help" for commands, "launch" to start')
rl.prompt()
