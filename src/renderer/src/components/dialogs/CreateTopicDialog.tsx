import { useState } from 'react'
import { useStore } from '../../state/store'
import Modal from './Modal'

export default function CreateTopicDialog(): React.JSX.Element {
  const setShowCreateTopic = useStore((s) => s.setShowCreateTopic)
  const createTopic = useStore((s) => s.createTopic)
  const showToast = useStore((s) => s.showToast)
  const brokers = useStore((s) => s.brokers)

  const [name, setName] = useState('')
  const [partitions, setPartitions] = useState('3')
  const [replication, setReplication] = useState(String(Math.min(3, Math.max(1, brokers.length))))
  const [busy, setBusy] = useState(false)

  const close = (): void => setShowCreateTopic(false)

  const create = async (): Promise<void> => {
    if (!name.trim()) {
      showToast('error', 'topic name is required')
      return
    }
    setBusy(true)
    try {
      await createTopic(name.trim(), Math.max(1, Number(partitions) || 1), Math.max(1, Number(replication) || 1))
      close()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Create topic"
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void create()} disabled={busy}>
            {busy ? <span className="spin" /> : 'Create'}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Topic name</label>
        <input
          className="input"
          autoFocus
          value={name}
          placeholder="orders.created"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void create()}
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Partitions</label>
          <input
            className="input"
            value={partitions}
            onChange={(e) => setPartitions(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
        <div className="field">
          <label>Replication factor (≤ {Math.max(1, brokers.length)} brokers)</label>
          <input
            className="input"
            value={replication}
            onChange={(e) => setReplication(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
      </div>
    </Modal>
  )
}
