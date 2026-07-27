import { writeFileSync, readFileSync } from 'node:fs'
import { BrowserWindow, dialog } from 'electron'
import type {
  ExportMessagesRequest,
  ExportResult,
  ImportMessagesRequest,
  ImportResult,
  KafkaMessage
} from '@shared/types'
import { getAdapter } from './kafka/manager'

const fromB64 = (v: string | null): string | null =>
  v === null ? null : Buffer.from(v, 'base64').toString('utf8')

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function toCsv(messages: KafkaMessage[]): string {
  const header = 'topic,partition,offset,timestamp,key,value'
  const rows = messages.map((m) =>
    [
      m.topic,
      String(m.partition),
      m.offset,
      new Date(Number(m.timestamp)).toISOString(),
      csvEscape(fromB64(m.key) ?? ''),
      csvEscape(fromB64(m.value) ?? '')
    ].join(',')
  )
  return [header, ...rows].join('\n') + '\n'
}

function toJson(messages: KafkaMessage[]): string {
  const items = messages.map((m) => ({
    topic: m.topic,
    partition: m.partition,
    offset: m.offset,
    timestamp: new Date(Number(m.timestamp)).toISOString(),
    key: fromB64(m.key),
    value: fromB64(m.value),
    headers: m.headers.map((h) => ({ key: h.key, value: fromB64(h.value) }))
  }))
  return JSON.stringify(items, null, 2) + '\n'
}

export async function exportMessages(
  win: BrowserWindow | null,
  req: ExportMessagesRequest
): Promise<ExportResult> {
  const ext = req.format
  const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined!, {
    defaultPath: `${req.topic.replace(/[^a-zA-Z0-9._-]/g, '_')}-messages.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  })
  if (canceled || !filePath) return { filePath: null, count: 0 }
  writeFileSync(filePath, req.format === 'csv' ? toCsv(req.messages) : toJson(req.messages), 'utf8')
  return { filePath, count: req.messages.length }
}

export async function saveToFile(
  win: BrowserWindow | null,
  suggestedName: string,
  contentBase64: string
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined!, {
    defaultPath: suggestedName
  })
  if (canceled || !filePath) return null
  writeFileSync(filePath, Buffer.from(contentBase64, 'base64'))
  return filePath
}

interface ImportedMessage {
  key?: string | null
  value?: string | null
  partition?: number
  headers?: { key: string; value: string | null }[]
}

/** Import a JSON array of {key, value, headers?, partition?} into a topic. */
export async function importMessages(
  win: BrowserWindow | null,
  req: ImportMessagesRequest
): Promise<ImportResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined!, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || filePaths.length === 0) return { count: 0, cancelled: true }

  const raw = JSON.parse(readFileSync(filePaths[0], 'utf8')) as unknown
  if (!Array.isArray(raw)) throw new Error('import file must contain a JSON array of messages')
  const items = raw as ImportedMessage[]

  const adapter = await getAdapter(req.profileId)
  let count = 0
  for (const item of items) {
    await adapter.produce({
      profileId: req.profileId,
      topic: req.topic,
      partition: typeof item.partition === 'number' ? item.partition : null,
      key: item.key ?? null,
      value: item.value === undefined ? null : item.value,
      headers: (item.headers ?? [])
        .filter((h) => h.value !== null)
        .map((h) => ({ key: h.key, value: h.value as string })),
      repeat: 1
    })
    count++
  }
  return { count, cancelled: false }
}
