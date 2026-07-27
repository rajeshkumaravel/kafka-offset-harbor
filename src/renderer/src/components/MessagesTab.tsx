import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { KafkaMessage } from '@shared/types'
import { useStore, type FilterMode } from '../state/store'
import { formatTimestamp, previewText } from '../lib/bytes'

const COLS = [
  { key: 'partition', label: 'Part', width: 56 },
  { key: 'offset', label: 'Offset', width: 90 },
  { key: 'timestamp', label: 'Timestamp', width: 170 },
  { key: 'key', label: 'Key', width: 160 },
  { key: 'value', label: 'Value', width: 520 }
] as const

export default function MessagesTab(): React.JSX.Element {
  const topicDetail = useStore((s) => s.topicDetail)
  const fetchParams = useStore((s) => s.fetchParams)
  const setFetchParams = useStore((s) => s.setFetchParams)
  const fetchMessages = useStore((s) => s.fetchMessages)
  const fetching = useStore((s) => s.fetching)
  const fetchResult = useStore((s) => s.fetchResult)
  const fetchError = useStore((s) => s.fetchError)
  const filterText = useStore((s) => s.filterText)
  const filterMode = useStore((s) => s.filterMode)
  const setFilter = useStore((s) => s.setFilter)
  const selectedMessage = useStore((s) => s.selectedMessage)
  const selectMessage = useStore((s) => s.selectMessage)
  const exportMessages = useStore((s) => s.exportMessages)
  const filteredMessages = useStore((s) => s.filteredMessages)
  const messages = useMemo(
    () => filteredMessages(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredMessages, fetchResult, filterText, filterMode]
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    overscan: 20
  })

  return (
    <>
      <div className="toolbar">
        <label>partition</label>
        <select
          className="select"
          value={fetchParams.partition === null ? 'all' : String(fetchParams.partition)}
          onChange={(e) =>
            setFetchParams({ partition: e.target.value === 'all' ? null : Number(e.target.value) })
          }
        >
          <option value="all">all</option>
          {topicDetail?.partitions.map((p) => (
            <option key={p.partition} value={p.partition}>
              {p.partition}
            </option>
          ))}
        </select>
        <label>from</label>
        <select
          className="select"
          value={fetchParams.from}
          onChange={(e) => setFetchParams({ from: e.target.value as typeof fetchParams.from })}
        >
          <option value="newest">newest</option>
          <option value="oldest">oldest</option>
          <option value="offset">offset</option>
          <option value="timestamp">time</option>
        </select>
        {fetchParams.from === 'offset' && (
          <input
            className="input narrow"
            value={fetchParams.startOffset}
            onChange={(e) => setFetchParams({ startOffset: e.target.value.replace(/[^0-9]/g, '') })}
            placeholder="offset"
          />
        )}
        {fetchParams.from === 'timestamp' && (
          <input
            type="datetime-local"
            className="input"
            value={fetchParams.startTime}
            onChange={(e) => setFetchParams({ startTime: e.target.value })}
          />
        )}
        <label>max</label>
        <input
          className="input narrow"
          style={{ width: 64 }}
          value={String(fetchParams.maxMessages)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^0-9]/g, ''))
            setFetchParams({ maxMessages: Math.min(5000, Math.max(1, n || 1)) })
          }}
        />
        <button className="btn small primary" disabled={fetching} onClick={() => void fetchMessages()}>
          {fetching ? <span className="spin" /> : 'Fetch'}
        </button>
        <span className="spacer" />
        {fetchResult && (
          <span className="stat">
            <b>{messages.length}</b>
            {filterText ? ` / ${fetchResult.messages.length}` : ''} msgs ·{' '}
            {fetchResult.durationMs} ms{fetchResult.truncated ? ' · truncated' : ''}
          </span>
        )}
        <button className="btn small ghost" disabled={messages.length === 0} onClick={() => void exportMessages('json')}>
          Export JSON
        </button>
        <button className="btn small ghost" disabled={messages.length === 0} onClick={() => void exportMessages('csv')}>
          CSV
        </button>
      </div>
      <div className="toolbar" style={{ borderTop: 'none' }}>
        <select
          className="select"
          value={filterMode}
          onChange={(e) => setFilter(filterText, e.target.value as FilterMode)}
        >
          <option value="contains">contains</option>
          <option value="regex">regex</option>
          <option value="jsonpath">jsonpath</option>
        </select>
        <input
          className="input"
          style={{ flex: 1, minWidth: 160 }}
          placeholder={
            filterMode === 'jsonpath'
              ? '$.customerId  or  $.status=DECLINED'
              : 'filter key / value / headers…'
          }
          value={filterText}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {fetchError && <div className="error-box">{fetchError}</div>}
      {!fetchError && messages.length === 0 && !fetching && (
        <div className="grid-empty">no messages — adjust the range and hit Fetch</div>
      )}
      {!fetchError && (messages.length > 0 || fetching) && (
        <div className="grid-scroll" ref={scrollRef}>
          <div className="grid-header">
            {COLS.map((c) => (
              <div key={c.key} className="grid-hcell" style={{ width: c.width }}>
                {c.label}
              </div>
            ))}
          </div>
          <div className="grid-body" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => {
              const m = messages[row.index]
              const isSel = selectedMessage === m
              return (
                <div
                  key={row.key}
                  className={`grid-row${isSel ? ' selected' : ''}`}
                  style={{ transform: `translateY(${row.start}px)` }}
                  onClick={() => selectMessage(m)}
                >
                  <Cell m={m} col="partition" width={56} />
                  <Cell m={m} col="offset" width={90} />
                  <Cell m={m} col="timestamp" width={170} />
                  <Cell m={m} col="key" width={160} />
                  <Cell m={m} col="value" width={520} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

function Cell({
  m,
  col,
  width
}: {
  m: KafkaMessage
  col: (typeof COLS)[number]['key']
  width: number
}): React.JSX.Element {
  if (col === 'partition') {
    return (
      <div className="grid-cell num" style={{ width }}>
        {m.partition}
      </div>
    )
  }
  if (col === 'offset') {
    return (
      <div className="grid-cell num" style={{ width }}>
        {m.offset}
      </div>
    )
  }
  if (col === 'timestamp') {
    return (
      <div className="grid-cell date" style={{ width }}>
        {formatTimestamp(m.timestamp)}
      </div>
    )
  }
  const raw = col === 'key' ? m.key : m.value
  if (raw === null) {
    return (
      <div className="grid-cell null" style={{ width }}>
        null
      </div>
    )
  }
  return (
    <div className="grid-cell" style={{ width }}>
      {previewText(raw)}
    </div>
  )
}
