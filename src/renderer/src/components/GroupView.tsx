import { useState } from 'react'
import { useStore } from '../state/store'

function lagClass(lag: string): string {
  const n = BigInt(lag)
  if (n === 0n) return 'zero'
  if (n < 100n) return 'low'
  return 'high'
}

function stateChip(state: string): React.JSX.Element {
  const cls =
    state.toLowerCase() === 'stable' ? 'stable' : state.toLowerCase() === 'empty' ? 'empty' : 'other'
  return <span className={`status-chip ${cls}`}>{state}</span>
}

type Tab = 'offsets' | 'members'

export default function GroupView(): React.JSX.Element {
  const groupDetail = useStore((s) => s.groupDetail)
  const detailLoading = useStore((s) => s.detailLoading)
  const detailError = useStore((s) => s.detailError)
  const setResetRequest = useStore((s) => s.setResetRequest)
  const deleteGroup = useStore((s) => s.deleteGroup)
  const [tab, setTab] = useState<Tab>('offsets')

  if (detailError) {
    return (
      <div className="center">
        <div className="error-box">{detailError}</div>
      </div>
    )
  }
  if (!groupDetail || detailLoading) {
    return (
      <div className="center">
        <div className="center-empty">
          <span className="spin" />
        </div>
      </div>
    )
  }

  const totalLag = groupDetail.offsets.reduce((acc, o) => acc + BigInt(o.lag), 0n)
  const topics = [...new Set(groupDetail.offsets.map((o) => o.topic))]

  return (
    <div className="center">
      <div className="center-header">
        <h2>{groupDetail.groupId}</h2>
        {stateChip(groupDetail.state)}
        <span className="sub">
          {groupDetail.memberCount} member{groupDetail.memberCount === 1 ? '' : 's'} · total lag{' '}
          {totalLag.toString()}
        </span>
        <span className="spacer" />
        <button
          className="btn small"
          disabled={groupDetail.memberCount > 0 || topics.length === 0}
          title={
            groupDetail.memberCount > 0
              ? 'offsets can only be reset while the group is empty (stop consumers first)'
              : undefined
          }
          onClick={() =>
            setResetRequest({ groupId: groupDetail.groupId, topic: topics[0] ?? '', partition: null })
          }
        >
          Reset offsets…
        </button>
        <button
          className="btn small ghost"
          style={{ color: 'var(--danger)' }}
          disabled={groupDetail.memberCount > 0}
          onClick={() => deleteGroup(groupDetail.groupId)}
        >
          Delete
        </button>
      </div>
      <div className="tab-row">
        <button className={`tab${tab === 'offsets' ? ' active' : ''}`} onClick={() => setTab('offsets')}>
          Offsets & Lag
        </button>
        <button className={`tab${tab === 'members' ? ' active' : ''}`} onClick={() => setTab('members')}>
          Members
        </button>
      </div>

      {tab === 'offsets' && (
        <div className="table-wrap" style={{ paddingTop: 10 }}>
          {groupDetail.offsets.length === 0 ? (
            <div className="grid-empty" style={{ padding: 40 }}>
              this group has no committed offsets
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th className="right">Partition</th>
                  <th className="right">Start</th>
                  <th className="right">End</th>
                  <th className="right">Committed</th>
                  <th className="right">Lag</th>
                </tr>
              </thead>
              <tbody>
                {groupDetail.offsets.map((o) => (
                  <tr key={`${o.topic}-${o.partition}`}>
                    <td>{o.topic}</td>
                    <td className="right">{o.partition}</td>
                    <td className="right">{o.earliestOffset}</td>
                    <td className="right">{o.latestOffset}</td>
                    <td className="right">{o.committedOffset}</td>
                    <td className="right">
                      <span className={`lag-chip ${lagClass(o.lag)}`}>{o.lag}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="table-wrap" style={{ paddingTop: 10 }}>
          {groupDetail.members.length === 0 ? (
            <div className="grid-empty" style={{ padding: 40 }}>
              no active members — the group is empty
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member ID</th>
                  <th>Client ID</th>
                  <th>Host</th>
                  <th>Assignment</th>
                </tr>
              </thead>
              <tbody>
                {groupDetail.members.map((m) => (
                  <tr key={m.memberId}>
                    <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.memberId}
                    </td>
                    <td>{m.clientId}</td>
                    <td>{m.clientHost}</td>
                    <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.assignedPartitions
                        .map((a) => `${a.topic}[${a.partitions.join(',')}]`)
                        .join(' ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
