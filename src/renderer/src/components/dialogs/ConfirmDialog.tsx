import { useState } from 'react'
import { useStore, type ConfirmRequest } from '../../state/store'
import Modal from './Modal'

export default function ConfirmDialog({ request }: { request: ConfirmRequest }): React.JSX.Element {
  const setConfirmRequest = useStore((s) => s.setConfirmRequest)
  const showToast = useStore((s) => s.showToast)
  const [busy, setBusy] = useState(false)

  const close = (): void => setConfirmRequest(null)

  return (
    <Modal
      title={request.title}
      onClose={close}
      danger={request.danger}
      footer={
        <>
          <button className="btn" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn ${request.danger ? 'danger' : 'primary'}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await request.action()
                close()
              } catch (err) {
                showToast('error', err instanceof Error ? err.message : String(err))
                setBusy(false)
              }
            }}
          >
            {busy ? <span className="spin" /> : request.confirmLabel}
          </button>
        </>
      }
    >
      <div className={`guard-banner${request.danger ? ' danger' : ''}`}>{request.body}</div>
    </Modal>
  )
}
