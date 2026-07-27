import { useStore } from '../state/store'

export default function BrokersView(): React.JSX.Element {
  const brokers = useStore((s) => s.brokers)

  return (
    <div className="center">
      <div className="center-header">
        <h2>Brokers</h2>
        <span className="sub">
          {brokers.length} node{brokers.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="tab-row" />
      <div className="table-wrap" style={{ paddingTop: 10 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Node ID</th>
              <th>Host</th>
              <th className="right">Port</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {brokers.map((b) => (
              <tr key={b.nodeId}>
                <td>{b.nodeId}</td>
                <td>{b.host}</td>
                <td className="right">{b.port}</td>
                <td className="sans">
                  {b.isController ? <span className="status-chip stable">controller</span> : 'broker'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
