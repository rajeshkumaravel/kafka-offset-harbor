import { useState } from 'react'
import { useStore } from '../state/store'

export default function PartitionsTab(): React.JSX.Element {
  const topicDetail = useStore((s) => s.topicDetail)
  const addPartitions = useStore((s) => s.addPartitions)
  const showToast = useStore((s) => s.showToast)
  const [adding, setAdding] = useState(false)
  const [count, setCount] = useState('')

  if (!topicDetail) return <div className="grid-empty">loading…</div>

  return (
    <div className="table-wrap" style={{ paddingTop: 10 }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Partition</th>
            <th className="right">Leader</th>
            <th>Replicas</th>
            <th>ISR</th>
            <th className="right">Earliest</th>
            <th className="right">Latest</th>
            <th className="right">Messages</th>
          </tr>
        </thead>
        <tbody>
          {topicDetail.partitions.map((p) => (
            <tr key={p.partition}>
              <td>{p.partition}</td>
              <td className="right">{p.leader}</td>
              <td>{p.replicas.join(', ')}</td>
              <td>{p.isr.join(', ')}</td>
              <td className="right">{p.earliestOffset}</td>
              <td className="right">{p.latestOffset}</td>
              <td className="right">
                {(BigInt(p.latestOffset) - BigInt(p.earliestOffset)).toString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        {!adding ? (
          <button className="btn small" onClick={() => setAdding(true)}>
            Add partitions…
          </button>
        ) : (
          <>
            <label style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>new total</label>
            <input
              className="input"
              style={{ width: 90 }}
              value={count}
              placeholder={String(topicDetail.partitionCount + 1)}
              onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <button
              className="btn small primary"
              onClick={async () => {
                const n = Number(count)
                if (!n || n <= topicDetail.partitionCount) {
                  showToast('error', `total must be greater than ${topicDetail.partitionCount}`)
                  return
                }
                try {
                  await addPartitions(topicDetail.name, n)
                  setAdding(false)
                  setCount('')
                } catch (err) {
                  showToast('error', err instanceof Error ? err.message : String(err))
                }
              }}
            >
              Apply
            </button>
            <button className="btn small ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
              partitions can only be added, never removed — key-based ordering changes
            </span>
          </>
        )}
      </div>
    </div>
  )
}
