import { useStore } from '../state/store'
import type { UpdateStatus } from '@shared/types'
import pkg from '../../../../package.json'

interface Props {
  updateStatus: UpdateStatus | null
}

export default function TopBar({ updateStatus }: Props): React.JSX.Element {
  const profiles = useStore((s) => s.profiles)
  const activeProfileId = useStore((s) => s.activeProfileId)
  const connState = useStore((s) => s.connState)
  const selectProfile = useStore((s) => s.selectProfile)
  const setShowConnections = useStore((s) => s.setShowConnections)
  const setShowHelp = useStore((s) => s.setShowHelp)
  const refreshTree = useStore((s) => s.refreshTree)
  const refreshSelection = useStore((s) => s.refreshSelection)
  const theme = useStore((s) => s.settings.theme)
  const setTheme = useStore((s) => s.setTheme)
  const detailsCollapsed = useStore((s) => s.detailsCollapsed)
  const setDetailsCollapsed = useStore((s) => s.setDetailsCollapsed)

  const active = profiles.find((p) => p.id === activeProfileId)
  const dotClass =
    connState === 'connected' ? 'connected' : connState === 'connecting' ? 'connecting' : connState === 'error' ? 'error' : ''
  const updateLabel =
    updateStatus?.state === 'error'
      ? 'Update failed'
      : updateStatus?.state === 'ready'
        ? 'Restart to update'
        : updateStatus?.state === 'progress'
          ? `Updating ${updateStatus.percent}%`
          : updateStatus?.state === 'downloading'
            ? 'Downloading update'
            : null

  return (
    <div className="topbar">
      <span className="brand">Kafka Offset Harbor</span>
      <span
        style={{
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: '10px',
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          border: '1px solid rgba(96, 165, 250, 0.3)',
          fontWeight: 500,
          marginRight: '6px'
        }}
      >
        v{pkg.version} • release check
      </span>
      {updateLabel && (
        <span
          className={`update-chip${updateStatus?.state === 'ready' ? ' ready' : ''}${updateStatus?.state === 'error' ? ' error' : ''}`}
          title={updateStatus?.state === 'error' ? updateStatus.message : 'Application update status'}
        >
          {updateLabel}
        </span>
      )}
      <div className="profile-select">
        <span className={`conn-dot ${dotClass}`} title={connState} />
        <select
          value={activeProfileId ?? ''}
          onChange={(e) => e.target.value && void selectProfile(e.target.value)}
        >
          <option value="" disabled>
            select a cluster…
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {active && active.color !== 'none' && (
        <span className={`env-badge ${active.color}`}>
          {active.color === 'red' ? 'prod' : active.color === 'amber' ? 'stage' : 'dev'}
        </span>
      )}
      <button className="btn small" onClick={() => setShowConnections(true)}>
        Connections
      </button>
      <button
        className="btn small ghost"
        disabled={connState !== 'connected'}
        onClick={() => {
          void refreshTree()
          void refreshSelection()
        }}
      >
        ⟳ Refresh
      </button>
      <div className="spacer" />
      <button
        className="btn small ghost help-btn"
        title="Help & About"
        aria-label="Help and About"
        onClick={() => setShowHelp(true)}
      >
        <span className="help-glyph">?</span>
      </button>
      <button
        className="btn small ghost"
        title={detailsCollapsed ? 'show details panel' : 'hide details panel'}
        onClick={() => setDetailsCollapsed(!detailsCollapsed)}
      >
        ◧
      </button>
      <button
        className="btn small ghost"
        title="toggle theme"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? '☀︎' : '☾'}
      </button>
    </div>
  )
}
