import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import MessagesTab from './MessagesTab'
import PartitionsTab from './PartitionsTab'
import ConfigsTab from './ConfigsTab'

type Tab = 'messages' | 'partitions' | 'configs'

export default function TopicView(): React.JSX.Element {
  const selection = useStore((s) => s.selection)
  const topicDetail = useStore((s) => s.topicDetail)
  const detailLoading = useStore((s) => s.detailLoading)
  const detailError = useStore((s) => s.detailError)
  const setShowProduce = useStore((s) => s.setShowProduce)
  const deleteTopic = useStore((s) => s.deleteTopic)
  const importMessages = useStore((s) => s.importMessages)
  const fetchMessages = useStore((s) => s.fetchMessages)
  const fetchResult = useStore((s) => s.fetchResult)

  const [tab, setTab] = useState<Tab>('messages')
  const topic = selection.kind === 'topic' ? selection.topic : ''

  // auto-fetch newest messages when a topic is first opened
  useEffect(() => {
    if (topic && !fetchResult) void fetchMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic])

  return (
    <div className="center">
      <div className="center-header">
        <h2>{topic}</h2>
        {topicDetail && (
          <span className="sub">
            {topicDetail.partitionCount} partitions · rf {topicDetail.replicationFactor} · ~
            {topicDetail.messageCount} messages
          </span>
        )}
        {detailLoading && <span className="spin" />}
        <span className="spacer" />
        <button className="btn small" onClick={() => setShowProduce(true)}>
          Produce…
        </button>
        <button className="btn small ghost" onClick={() => void importMessages()}>
          Import…
        </button>
        <button className="btn small ghost" style={{ color: 'var(--danger)' }} onClick={() => deleteTopic(topic)}>
          Delete
        </button>
      </div>
      <div className="tab-row">
        {(['messages', 'partitions', 'configs'] as const).map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {detailError && <div className="error-box">{detailError}</div>}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'partitions' && <PartitionsTab />}
      {tab === 'configs' && <ConfigsTab />}
    </div>
  )
}
