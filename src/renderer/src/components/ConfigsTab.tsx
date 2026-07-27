import { useState } from 'react'
import { useStore } from '../state/store'

export default function ConfigsTab(): React.JSX.Element {
  const topicConfigs = useStore((s) => s.topicConfigs)
  const setTopicConfig = useStore((s) => s.setTopicConfig)
  const showToast = useStore((s) => s.showToast)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (!topicConfigs) return <div className="grid-empty">loading…</div>

  const save = async (name: string): Promise<void> => {
    try {
      await setTopicConfig(name, draft)
      setEditing(null)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="table-wrap" style={{ paddingTop: 10 }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Config</th>
            <th>Value</th>
            <th>Source</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {topicConfigs.map((c) => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {editing === c.name ? (
                  <input
                    className="input"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void save(c.name)
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  c.value ?? <span style={{ color: 'var(--fg-faint)' }}>—</span>
                )}
              </td>
              <td className="sans" style={{ color: 'var(--fg-faint)', fontSize: 11 }}>
                {c.isDefault ? 'default' : 'topic'}
              </td>
              <td className="right sans">
                {editing === c.name ? (
                  <>
                    <button className="btn small primary" onClick={() => void save(c.name)}>
                      Save
                    </button>{' '}
                    <button className="btn small ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  !c.readOnly && (
                    <button
                      className="btn small ghost"
                      onClick={() => {
                        setEditing(c.name)
                        setDraft(c.value ?? '')
                      }}
                    >
                      Edit
                    </button>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
