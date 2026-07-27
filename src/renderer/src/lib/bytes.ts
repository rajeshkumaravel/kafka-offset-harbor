/** Helpers for rendering raw message bytes (transported as base64). */

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function b64ToUtf8(b64: string): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(b64ToBytes(b64))
}

export function utf8ToB64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function toHexDump(b64: string): string {
  const bytes = b64ToBytes(b64)
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.subarray(i, i + 16)
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, '0')).join(' ')
    const ascii = [...chunk].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')
    lines.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`)
  }
  return lines.join('\n')
}

export type RenderFormat = 'auto' | 'text' | 'json' | 'xml' | 'hex'

export interface RenderedPayload {
  text: string
  language: 'json' | 'xml' | 'plaintext'
}

export function tryPrettyJson(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return null
  }
}

function tryPrettyXml(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('<')) return null
  // lightweight indent: split tags onto lines
  const withBreaks = trimmed.replace(/>\s*</g, '>\n<')
  let indent = 0
  return withBreaks
    .split('\n')
    .map((line) => {
      if (/^<\//.test(line)) indent = Math.max(0, indent - 1)
      const out = '  '.repeat(indent) + line
      if (/^<[^!?/][^>]*[^/]>$/.test(line) && !/<\/[^>]+>$/.test(line)) indent++
      return out
    })
    .join('\n')
}

/** Render payload bytes according to the requested format ('auto' sniffs JSON/XML). */
export function renderPayload(b64: string | null, format: RenderFormat): RenderedPayload {
  if (b64 === null) return { text: '∅ null (tombstone)', language: 'plaintext' }
  if (format === 'hex') return { text: toHexDump(b64), language: 'plaintext' }
  const text = b64ToUtf8(b64)
  if (format === 'text') return { text, language: 'plaintext' }
  if (format === 'json') return { text: tryPrettyJson(text) ?? text, language: 'json' }
  if (format === 'xml') return { text: tryPrettyXml(text) ?? text, language: 'xml' }
  // auto
  const json = tryPrettyJson(text)
  if (json !== null) return { text: json, language: 'json' }
  const xml = tryPrettyXml(text)
  if (xml !== null) return { text: xml, language: 'xml' }
  return { text, language: 'plaintext' }
}

export function previewText(b64: string | null, max = 160): string {
  if (b64 === null) return ''
  const text = b64ToUtf8(b64).replace(/\s+/g, ' ')
  return text.length > max ? text.slice(0, max) + '…' : text
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function formatTimestamp(ts: string): string {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const d = new Date(n)
  return d.toISOString().replace('T', ' ').replace('Z', '')
}

/**
 * Minimal JsonPath subset for message filtering: $.a.b[2].c
 * Returns the stringified value at the path, or undefined.
 */
export function jsonPathLookup(payloadText: string, path: string): string | undefined {
  let obj: unknown
  try {
    obj = JSON.parse(payloadText)
  } catch {
    return undefined
  }
  const parts = path
    .replace(/^\$\.?/, '')
    .split(/\.|\[(\d+)\]/)
    .filter((p) => p !== undefined && p !== '')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  if (cur === undefined) return undefined
  return typeof cur === 'string' ? cur : JSON.stringify(cur)
}
