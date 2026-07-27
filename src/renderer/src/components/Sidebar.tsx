import { useState } from 'react'
import { useStore } from '../state/store'

export default function Sidebar(): React.JSX.Element {
  const connState = useStore((s) => s.connState)
  const connError = useStore((s) => s.connError)
  const brokers = useStore((s) => s.brokers)
  const topics = useStore((s) => s.topics)
  const groups = useStore((s) => s.groups)
  const treeSearch = useStore((s) => s.treeSearch)
  const setTreeSearch = useStore((s) => s.setTreeSearch)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const setShowCreateTopic = useStore((s) => s.setShowCreateTopic)

  const [open, setOpen] = useState({ brokers: true, topics: true, groups: true })
  const [showInternal, setShowInternal] = useState(false)

  const needle = treeSearch.trim().toLowerCase()
  const visibleTopics = topics.filter(
    (t) => (showInternal || !t.internal) && (!needle || t.name.toLowerCase().includes(needle))
  )
  const visibleGroups = groups.filter((g) => !needle || g.groupId.toLowerCase().includes(needle))

  if (connState === 'idle') {
    return (
      <div className="sidebar">
        <div className="sidebar-empty">Select a cluster connection to browse it.</div>
      </div>
    )
  }
  if (connState === 'connecting') {
    return (
      <div className="sidebar">
        <div className="sidebar-empty">
          <span className="spin" style={{ marginRight: 8 }} />
          Connecting…
        </div>
      </div>
    )
  }
  if (connState === 'error') {
    return (
      <div className="sidebar">
        <div className="error-box">{connError}</div>
      </div>
    )
  }

  const toggle = (key: keyof typeof open): void => setOpen((o) => ({ ...o, [key]: !o[key] }))

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="row">
          <input
            className="search-input"
            placeholder="filter topics & groups…"
            value={treeSearch}
            onChange={(e) => setTreeSearch(e.target.value)}
          />
          <button className="btn small" title="create topic" onClick={() => setShowCreateTopic(true)}>
            +
          </button>
        </div>
      </div>
      <div className="tree">
        <div className="tree-section">
          <div className="tree-section-header" onClick={() => toggle('brokers')}>
            <span className={`chevron${open.brokers ? ' open' : ''}`}>▶</span> Brokers
            <span className="count">{brokers.length}</span>
          </div>
          {open.brokers && (
            <div
              className={`tree-item${selection.kind === 'brokers' ? ' selected' : ''}`}
              onClick={() => void select({ kind: 'brokers' })}
            >
              <span className="name">all brokers</span>
              <span className="meta">
                {brokers.find((b) => b.isController)?.nodeId ?? '—'} ctrl
              </span>
            </div>
          )}
        </div>

        <div className="tree-section">
          <div className="tree-section-header" onClick={() => toggle('topics')}>
            <span className={`chevron${open.topics ? ' open' : ''}`}>▶</span> Topics
            <span className="count">{visibleTopics.length}</span>
          </div>
          {open.topics && (
            <>
              {visibleTopics.map((t) => (
                <div
                  key={t.name}
                  className={`tree-item${t.internal ? ' internal' : ''}${
                    selection.kind === 'topic' && selection.topic === t.name ? ' selected' : ''
                  }`}
                  onClick={() => void select({ kind: 'topic', topic: t.name })}
                >
                  <span className="name">{t.name}</span>
                  <span className="meta">
                    {t.partitionCount}p ×{t.replicationFactor}
                  </span>
                </div>
              ))}
              {visibleTopics.length === 0 && <div className="tree-empty">no topics match</div>}
              {topics.some((t) => t.internal) && (
                <div
                  className="tree-empty"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowInternal((v) => !v)}
                >
                  {showInternal ? 'hide internal topics' : 'show internal topics'}
                </div>
              )}
            </>
          )}
        </div>

        <div className="tree-section">
          <div className="tree-section-header" onClick={() => toggle('groups')}>
            <span className={`chevron${open.groups ? ' open' : ''}`}>▶</span> Consumer Groups
            <span className="count">{visibleGroups.length}</span>
          </div>
          {open.groups && (
            <>
              {visibleGroups.map((g) => (
                <div
                  key={g.groupId}
                  className={`tree-item${
                    selection.kind === 'group' && selection.groupId === g.groupId ? ' selected' : ''
                  }`}
                  onClick={() => void select({ kind: 'group', groupId: g.groupId })}
                >
                  <span className="name">{g.groupId}</span>
                  <span className="meta">{g.memberCount}m</span>
                </div>
              ))}
              {visibleGroups.length === 0 && <div className="tree-empty">no groups match</div>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
