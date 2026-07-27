import { useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useStore } from '../state/store'
import {
  b64ToUtf8,
  formatBytes,
  formatTimestamp,
  renderPayload,
  type RenderFormat
} from '../lib/bytes'

const FORMATS: RenderFormat[] = ['auto', 'text', 'json', 'xml', 'hex']

export default function DetailsPanel(): React.JSX.Element {
  const selectedMessage = useStore((s) => s.selectedMessage)
  const selection = useStore((s) => s.selection)
  const topicDetail = useStore((s) => s.topicDetail)
  const theme = useStore((s) => s.settings.theme)
  const saveMessagePart = useStore((s) => s.saveMessagePart)
  const [format, setFormat] = useState<RenderFormat>('auto')
  const [showKeyHex, setShowKeyHex] = useState(false)

  const m = selectedMessage
  const payload = useMemo(() => (m ? renderPayload(m.value, format) : null), [m, format])
  const keyPayload = useMemo(
    () => (m ? renderPayload(m.key, showKeyHex ? 'hex' : 'auto') : null),
    [m, showKeyHex]
  )

  if (!m) {
    return (
      <div className="details">
        {selection.kind === 'topic' && topicDetail ? (
          <section>
            <h3>Topic</h3>
            <dl className="meta-grid">
              <dt>name</dt>
              <dd>{topicDetail.name}</dd>
              <dt>partitions</dt>
              <dd>{topicDetail.partitionCount}</dd>
              <dt>replication</dt>
              <dd>{topicDetail.replicationFactor}</dd>
              <dt>messages</dt>
              <dd>~{topicDetail.messageCount}</dd>
            </dl>
          </section>
        ) : (
          <div className="details-empty">Select a message to inspect it here.</div>
        )}
      </div>
    )
  }

  return (
    <div className="details" style={{ display: 'flex' }}>
      <section>
        <h3>
          Message
          <span style={{ display: 'flex', gap: 4 }}>
            <button className="btn small ghost" onClick={() => void saveMessagePart('key')} disabled={m.key === null}>
              save key
            </button>
            <button className="btn small ghost" onClick={() => void saveMessagePart('value')} disabled={m.value === null}>
              save value
            </button>
          </span>
        </h3>
        <dl className="meta-grid">
          <dt>topic</dt>
          <dd>{m.topic}</dd>
          <dt>partition</dt>
          <dd>{m.partition}</dd>
          <dt>offset</dt>
          <dd>{m.offset}</dd>
          <dt>timestamp</dt>
          <dd>{formatTimestamp(m.timestamp)}</dd>
          <dt>key size</dt>
          <dd>{formatBytes(m.keySize)}</dd>
          <dt>value size</dt>
          <dd>{formatBytes(m.valueSize)}</dd>
        </dl>
      </section>

      <section>
        <h3>
          Key
          <button className="btn small ghost" onClick={() => setShowKeyHex((v) => !v)}>
            {showKeyHex ? 'text' : 'hex'}
          </button>
        </h3>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: m.key === null ? 'var(--fg-faint)' : 'var(--fg-muted)',
            maxHeight: 90,
            overflow: 'auto'
          }}
        >
          {keyPayload?.text}
        </div>
      </section>

      {m.headers.length > 0 && (
        <section>
          <h3>Headers ({m.headers.length})</h3>
          {m.headers.map((h, i) => (
            <div key={i} className="header-item">
              <span className="hk">{h.key}</span>
              <span className="hv">{b64ToUtf8(h.value)}</span>
            </div>
          ))}
        </section>
      )}

      <section className="grow">
        <h3>
          Value
          <span className="format-row">
            {FORMATS.map((f) => (
              <button
                key={f}
                className={`btn small ghost${format === f ? ' active' : ''}`}
                onClick={() => setFormat(f)}
              >
                {f}
              </button>
            ))}
          </span>
        </h3>
        <div className="payload-editor">
          <Editor
            height="100%"
            language={payload?.language ?? 'plaintext'}
            value={payload?.text ?? ''}
            theme={theme === 'dark' ? 'koe-dark' : 'koe-light'}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              lineNumbers: 'off',
              wordWrap: format === 'hex' ? 'off' : 'on',
              scrollBeyondLastLine: false,
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)',
              renderLineHighlight: 'none',
              folding: true,
              contextmenu: false
            }}
          />
        </div>
      </section>
    </div>
  )
}
