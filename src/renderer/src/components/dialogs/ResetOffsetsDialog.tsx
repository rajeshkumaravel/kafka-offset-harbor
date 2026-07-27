import { useState } from 'react'
import type { ResetTarget } from '@shared/types'
import { useStore } from '../../state/store'
import Modal from './Modal'

interface Props {
  request: { groupId: string; topic: string; partition: number | null }
}

export default function ResetOffsetsDialog({ request }: Props): React.JSX.Element {
  const groupDetail = useStore((s) => s.groupDetail)
  const setResetRequest = useStore((s) => s.setResetRequest)
  const resetOffsets = useStore((s) => s.resetOffsets)
  const showToast = useStore((s) => s.showToast)

  const topics = [...new Set((groupDetail?.offsets ?? []).map((o) => o.topic))]
  const [topic, setTopic] = useState(request.topic || topics[0] || '')
  const [partition, setPartition] = useState<string>(
    request.partition === null ? 'all' : String(request.partition)
  )
  const [target, setTarget] = useState<ResetTarget>('earliest')
  const [offset, setOffset] = useState('0')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)

  const partitions = [
    ...new Set((groupDetail?.offsets ?? []).filter((o) => o.topic === topic).map((o) => o.partition))
  ].sort((a, b) => a - b)

  const close = (): void => setResetRequest(null)

  const apply = async (): Promise<void> => {
    setBusy(true)
    try {
      await resetOffsets({
        groupId: request.groupId,
        topic,
        partition: partition === 'all' ? null : Number(partition),
        target,
        offset: target === 'offset' ? offset : undefined,
        timestamp: target === 'timestamp' && time ? new Date(time).getTime() : undefined
      })
      close()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Reset offsets — ${request.groupId}`}
      onClose={close}
      danger
      footer={
        <>
          <button className="btn" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="btn danger" onClick={() => void apply()} disabled={busy || !topic}>
            {busy ? <span className="spin" /> : 'Reset offsets'}
          </button>
        </>
      }
    >
      <div className="guard-banner">
        Resetting offsets changes where this group resumes consuming. Consumers must be stopped —
        the group has to be empty for the reset to apply.
      </div>
      <div className="field-row">
        <div className="field">
          <label>Topic</label>
          <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Partition</label>
          <select className="select" value={partition} onChange={(e) => setPartition(e.target.value)}>
            <option value="all">all</option>
            {partitions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Reset to</label>
        <select className="select" value={target} onChange={(e) => setTarget(e.target.value as ResetTarget)}>
          <option value="earliest">earliest (reprocess everything)</option>
          <option value="latest">latest (skip to end)</option>
          <option value="offset">specific offset</option>
          <option value="timestamp">timestamp</option>
        </select>
      </div>
      {target === 'offset' && (
        <div className="field">
          <label>Offset</label>
          <input
            className="input"
            value={offset}
            onChange={(e) => setOffset(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
      )}
      {target === 'timestamp' && (
        <div className="field">
          <label>Resume from time</label>
          <input type="datetime-local" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      )}
    </Modal>
  )
}
