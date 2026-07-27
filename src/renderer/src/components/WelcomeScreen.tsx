import { useStore } from '../state/store'
import Greeting from './Greeting'
import appIcon from '../assets/app-icon.png'

export default function WelcomeScreen(): React.JSX.Element {
  const finishWelcome = useStore((s) => s.finishWelcome)

  return (
    <div className="welcome">
      <div className="welcome-card">
        <img className="welcome-icon" src={appIcon} alt="" />
        <Greeting />
        <h1 className="welcome-title">Welcome to Kafka Offset Harbor</h1>
        <p className="welcome-sub">
          A desktop window into Apache Kafka — browse topics, read real messages, and watch
          consumer lag, without living in the command line.
        </p>

        <div className="welcome-points">
          <div className="welcome-point">
            <span className="wp-dot" />
            <span>Everything stays on your device — credentials are encrypted with your OS keychain.</span>
          </div>
          <div className="welcome-point">
            <span className="wp-dot" />
            <span>Nothing is sent to any external service, and there’s no telemetry.</span>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="btn primary welcome-btn" onClick={() => finishWelcome('demo')}>
            Explore the demo cluster
          </button>
          <button className="btn welcome-btn" onClick={() => finishWelcome('connect')}>
            Connect to a cluster
          </button>
        </div>
        <p className="welcome-foot">
          No broker needed to start — the built-in demo cluster comes with sample topics, messages
          and consumer groups.
        </p>
      </div>
    </div>
  )
}
