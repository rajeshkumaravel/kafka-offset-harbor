// Assemble resources/icon.ico from PNG sizes rendered by sips.
// Windows Vista+ accepts PNG-encoded ICO entries, so we pack the PNGs
// directly into the ICO container (ICONDIR + ICONDIRENTRY[] + PNG data).
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'

const APP_DIR = path.resolve(import.meta.dirname, '..')
const RES = path.join(APP_DIR, 'resources')
const MASTER = path.join(RES, 'icon.png')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

const tmp = fs.mkdtempSync(path.join(RES, '.ico-'))
try {
  const pngs = SIZES.map((size) => {
    const out = path.join(tmp, `${size}.png`)
    execSync(`sips -z ${size} ${size} "${MASTER}" --out "${out}"`, { stdio: 'ignore' })
    return { size, data: fs.readFileSync(out) }
  })

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = icon
  header.writeUInt16LE(pngs.length, 4) // image count

  const entries = Buffer.alloc(16 * pngs.length)
  let offset = header.length + entries.length
  pngs.forEach((png, i) => {
    const e = i * 16
    entries.writeUInt8(png.size >= 256 ? 0 : png.size, e + 0) // width (0 = 256)
    entries.writeUInt8(png.size >= 256 ? 0 : png.size, e + 1) // height (0 = 256)
    entries.writeUInt8(0, e + 2) // palette count
    entries.writeUInt8(0, e + 3) // reserved
    entries.writeUInt16LE(1, e + 4) // color planes
    entries.writeUInt16LE(32, e + 6) // bits per pixel
    entries.writeUInt32LE(png.data.length, e + 8) // size of PNG data
    entries.writeUInt32LE(offset, e + 12) // offset of PNG data
    offset += png.data.length
  })

  const ico = Buffer.concat([header, entries, ...pngs.map((p) => p.data)])
  fs.writeFileSync(path.join(RES, 'icon.ico'), ico)
  console.log(`wrote resources/icon.ico (${pngs.length} sizes: ${SIZES.join(', ')})`)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
