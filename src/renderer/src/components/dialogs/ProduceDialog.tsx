import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { useStore } from '../../state/store'
import { tryPrettyJson } from '../../lib/bytes'
import Modal from './Modal'

export default function ProduceDialog(): React.JSX.Element {
  const selection = useStore((s) => s.selection)
  const topicDetail = useStore((s) => s.topicDetail)
  const setShowProduce = useStore((s) => s.setShowProduce)
  const produce = useStore((s) => s.produce)
  const showToast = useStore((s) => s.showToast)
  const theme = useStore((s) => s.settings.theme)

  const topic = selection.kind === 'topic' ? selection.topic : ''
  const [key, setKey] = useState('')
  const [nullKey, setNullKey] = useState(false)
  const [value, setValue] = useState('{\n  \n}')
  const [tombstone, setTombstone] = useState(false)
  const [partition, setPartition] = useState<string>('auto')
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([])
  const [repeat, setRepeat] = useState('1')
  const [busy, setBusy] = useState(false)

  const close = (): void => setShowProduce(false)

  const send = async (): Promise<void> => {
    setBusy(true)
    try {
      await produce({
        topic,
        partition: partition === 'auto' ? null : Number(partition),
        key: nullKey ? null : key,
        value: tombstone ? null : value,
        headers: headers.filter((h) => h.key.trim() !== ''),
        repeat: Math.min(1000, Math.max(1, Number(repeat) || 1))
      })
      close()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Produce to ${topic}`}
      onClose={close}
      wide
      footer={
        <>
          <button className="btn" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void send()} disabled={busy}>
            {busy ? <span className="spin" /> : 'Produce'}
          </button>
        </>
      }
    >
      <div className="field-row">
        <div className="field" style={{ flex: 2 }}>
          <label>Key</label>
          <input
            className="input"
            value={nullKey ? '' : key}
            disabled={nullKey}
            placeholder={nullKey ? 'null' : 'message key (drives partitioning)'}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Partition</label>
          <select className="select" value={partition} onChange={(e) => setPartition(e.target.value)}>
            <option value="auto">auto (by key)</option>
            {topicDetail?.partitions.map((p) => (
              <option key={p.partition} value={p.partition}>
                {p.partition}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Repeat ×</label>
          <input
            className="input"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={nullKey} onChange={(e) => setNullKey(e.target.checked)} />
        null key
      </label>

      <div className="field">
        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Value</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn small ghost"
              disabled={tombstone}
              onClick={() => {
                const pretty = tryPrettyJson(value)
                if (pretty) setValue(pretty)
                else showToast('error', 'value is not valid JSON')
              }}
            >
              format json
            </button>
          </span>
        </label>
        <div
          className="payload-editor"
          style={{ height: 180, opacity: tombstone ? 0.4 : 1, pointerEvents: tombstone ? 'none' : 'auto' }}
        >
          <Editor
            height="100%"
            language="json"
            value={tombstone ? '∅ tombstone (null value)' : value}
            theme={theme === 'dark' ? 'koe-dark' : 'koe-light'}
            onChange={(v) => setValue(v ?? '')}
            options={{
              minimap: { enabled: false },
              lineNumbers: 'off',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              fontSize: 12,
              renderLineHighlight: 'none'
            }}
          />
        </div>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={tombstone} onChange={(e) => setTombstone(e.target.checked)} />
        tombstone (null value — deletes the key on compacted topics)
      </label>

      <div className="field">
        <label>Headers</label>
        {headers.map((h, i) => (
          <div key={i} className="kv-row">
            <input
              className="input"
              placeholder="header key"
              value={h.key}
              onChange={(e) =>
                setHeaders(headers.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
              }
            />
            <input
              className="input"
              placeholder="header value"
              value={h.value}
              onChange={(e) =>
                setHeaders(headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
              }
            />
            <button className="btn small ghost" onClick={() => setHeaders(headers.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <div>
          <button className="btn small ghost" onClick={() => setHeaders([...headers, { key: '', value: '' }])}>
            + add header
          </button>
        </div>
      </div>
    </Modal>
  )
}
