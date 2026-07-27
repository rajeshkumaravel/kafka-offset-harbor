// Dev-only cosmetic fix: `npm run dev` runs inside node_modules' stock
// Electron.app, so macOS shows "Electron" as the dock/menu name regardless of
// app.setName(). Patch that bundle's Info.plist so dev matches the product.
// The packaged app is unaffected (electron-builder sets its own name).
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import * as path from 'node:path'

const NAME = 'Kafka Offset Harbor'
const plist = path.resolve(
  import.meta.dirname,
  '..',
  'node_modules/electron/dist/Electron.app/Contents/Info.plist'
)

if (process.platform !== 'darwin' || !existsSync(plist)) {
  process.exit(0) // nothing to do off-macOS or before install
}

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${NAME}`, plist])
  } catch {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${NAME}`, plist])
  }
}
// Refresh Launch Services + touch the bundle so the dock picks up the new name
try {
  execFileSync('touch', [path.dirname(path.dirname(plist))])
} catch {
  // best effort
}
console.log(`dev Electron.app renamed to "${NAME}"`)
