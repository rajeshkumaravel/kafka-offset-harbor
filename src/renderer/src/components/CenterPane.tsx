import { useStore } from '../state/store'
import BrokersView from './BrokersView'
import TopicView from './TopicView'
import GroupView from './GroupView'

export default function CenterPane(): React.JSX.Element {
  const selection = useStore((s) => s.selection)
  const connState = useStore((s) => s.connState)

  if (connState !== 'connected' || selection.kind === 'none') {
    return (
      <div className="center">
        <div className="center-empty">
          <div className="big">Kafka Offset Harbor</div>
          <div>
            {connState === 'connected'
              ? 'Pick a topic or consumer group from the tree to explore it.'
              : 'Connect to a cluster to get started.'}
          </div>
        </div>
      </div>
    )
  }
  if (selection.kind === 'brokers') return <BrokersView />
  if (selection.kind === 'topic') return <TopicView key={selection.topic} />
  return <GroupView key={selection.groupId} />
}
