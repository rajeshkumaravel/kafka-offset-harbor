import { useCallback, useEffect, useState } from 'react'
import { useStore } from './state/store'
import type { UpdateStatus } from '@shared/types'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import CenterPane from './components/CenterPane'
import DetailsPanel from './components/DetailsPanel'
import WelcomeScreen from './components/WelcomeScreen'
import ConnectionsDialog from './components/dialogs/ConnectionsDialog'
import HelpDialog from './components/dialogs/HelpDialog'
import ProduceDialog from './components/dialogs/ProduceDialog'
import CreateTopicDialog from './components/dialogs/CreateTopicDialog'
import ResetOffsetsDialog from './components/dialogs/ResetOffsetsDialog'
import ConfirmDialog from './components/dialogs/ConfirmDialog'

function useColumnDrag(
  initial: number,
  min: number,
  max: number,
  invert = false
): [number, (e: React.MouseEvent) => void] {
  const [width, setWidth] = useState(initial)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = width
      const move = (ev: MouseEvent): void => {
        const delta = (ev.clientX - startX) * (invert ? -1 : 1)
        setWidth(Math.min(max, Math.max(min, startW + delta)))
      }
      const up = (): void => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [width, min, max, invert]
  )
  return [width, onMouseDown]
}

export default function App(): React.JSX.Element {
  const ready = useStore((s) => s.ready)
  const init = useStore((s) => s.init)
  const detailsCollapsed = useStore((s) => s.detailsCollapsed)
  const toast = useStore((s) => s.toast)
  const showConnections = useStore((s) => s.showConnections)
  const showHelp = useStore((s) => s.showHelp)
  const welcome = useStore((s) => s.welcome)
  const showProduce = useStore((s) => s.showProduce)
  const showCreateTopic = useStore((s) => s.showCreateTopic)
  const resetRequest = useStore((s) => s.resetRequest)
  const confirmRequest = useStore((s) => s.confirmRequest)

  const [sidebarW, onSidebarDrag] = useColumnDrag(300, 220, 500)
  const [detailsW, onDetailsDrag] = useColumnDrag(380, 280, 640, true)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => window.api.onUpdateStatus((status) => setUpdateStatus(status)), [])

  if (!ready) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyItems: 'center' }}>
        <div
          style={{
            gridRow: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--fg-muted)'
          }}
        >
          <span className="spin" /> Preparing workspace…
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar updateStatus={updateStatus} />
      <div
        className={`app-body${detailsCollapsed ? ' details-collapsed' : ''}`}
        style={{ ['--sidebar-w' as string]: `${sidebarW}px`, ['--details-w' as string]: `${detailsW}px` }}
      >
        <Sidebar />
        <div className="pane-divider" onMouseDown={onSidebarDrag} />
        <CenterPane />
        <div className="pane-divider" onMouseDown={detailsCollapsed ? undefined : onDetailsDrag} />
        {!detailsCollapsed && <DetailsPanel />}
      </div>

      {showConnections && <ConnectionsDialog />}
      {showHelp && <HelpDialog />}
      {showProduce && <ProduceDialog />}
      {showCreateTopic && <CreateTopicDialog />}
      {resetRequest && <ResetOffsetsDialog request={resetRequest} />}
      {confirmRequest && <ConfirmDialog request={confirmRequest} />}
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
      {welcome && <WelcomeScreen />}
    </div>
  )
}
