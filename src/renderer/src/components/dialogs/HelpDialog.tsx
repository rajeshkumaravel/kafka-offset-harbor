import { useState } from 'react'
import { useStore } from '../../state/store'
import Modal from './Modal'
import packageJson from '../../../../../package.json'

type Tab = 'about' | 'version' | 'howto' | 'builtwith' | 'security' | 'reset'

const BUILT_WITH: { name: string; role: string }[] = [
  { name: 'Electron', role: 'Cross-platform desktop shell' },
  { name: 'React + TypeScript', role: 'Typed, component-based user interface' },
  { name: 'electron-vite', role: 'Build tooling & hot reload' },
  { name: 'kafkajs', role: 'Kafka admin, consumer & producer client' },
  { name: 'aws-msk-iam-sasl-signer', role: 'AWS MSK IAM authentication tokens' },
  { name: 'better-sqlite3', role: 'Local store for connections & settings' },
  { name: 'Monaco Editor', role: 'Message payload viewer (VS Code engine)' },
  { name: 'TanStack Virtual', role: 'Virtualized message grid' },
  { name: 'Zustand', role: 'Application state management' }
]

const HOWTO: { step: string; title: string; body: string }[] = [
  {
    step: '1',
    title: 'Connect to a cluster',
    body: 'Open Connections in the header, add your bootstrap servers and security, then Test and Save. Or just pick the built-in Demo Cluster to explore with no broker.'
  },
  {
    step: '2',
    title: 'Browse the tree',
    body: 'The left sidebar lists brokers, topics and consumer groups. Use the filter box to narrow it down; click any item to open it.'
  },
  {
    step: '3',
    title: 'Read messages',
    body: 'On a topic’s Messages tab, choose where to read from (newest, oldest, an offset or a time) and hit Fetch. Click a row to inspect its key, value and headers as JSON, XML, text or hex.'
  },
  {
    step: '4',
    title: 'Check consumer lag',
    body: 'Open a consumer group to see per-partition committed offsets and lag, colour-coded from caught-up (green) to investigate (red).'
  },
  {
    step: '5',
    title: 'Take action',
    body: 'Reset a group’s offsets (earliest, latest, offset or timestamp), produce test messages, or manage topics and configs — destructive actions always ask first.'
  }
]

export default function HelpDialog(): React.JSX.Element {
  const setShowHelp = useStore((s) => s.setShowHelp)
  const resetApp = useStore((s) => s.resetApp)
  const resetting = useStore((s) => s.resetting)
  const [tab, setTab] = useState<Tab>('about')
  const [confirmText, setConfirmText] = useState('')
  const close = (): void => setShowHelp(false)

  return (
    <Modal title="Help & About" onClose={close} wide>
      <div className="tab-row" style={{ padding: '0 0 0', marginBottom: 14 }}>
        {(
          [
            ['about', 'What is this?'],
            ['version', 'Version'],
            ['howto', 'How to use'],
            ['builtwith', 'Built with'],
            ['security', 'Security'],
            ['reset', 'Reset']
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'about' && (
        <div className="help-body">
          <h4>What is Kafka Offset Harbor?</h4>
          <p>
            <b>Kafka Offset Harbor</b> is a desktop app for looking inside Apache Kafka. Kafka
            moves data between systems — orders, payments, events — but that data is normally
            invisible, living inside the cluster with no built-in window to see it. This app is that
            window: browse topics, read real messages, and watch how far behind your consumers are —
            without living in the command line.
          </p>
          <p>
            Website:{' '}
            <a
              href="https://rajeshk.dev/kafka-harbor?utm_source=kafkaharbor&utm_medium=help&utm_campaign=kafkaharbor"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://rajeshk.dev/kafka-harbor
            </a>
          </p>
          <h4>Who it’s for</h4>
          <p>
            Support and platform engineers who need to answer “did this message arrive?”, “why is
            this consumer behind?”, or “can we replay this?” — quickly and safely.
          </p>
          <h4>Inspiration</h4>
          <p>
            Inspired by the classic desktop Kafka clients, rebuilt with a modern, cross-platform
            stack and a clean, keyboard-friendly interface — a fast, local-first, open-source tool
            that puts a friendly face on infrastructure.
          </p>
        </div>
      )}

      {tab === 'version' && (
        <div className="help-body">
          <h4>Version</h4>
          <p>
            Current App Version: <b>v{packageJson.version}</b>
          </p>
        </div>
      )}

      {tab === 'howto' && (
        <div className="help-body">
          <p>Five steps from zero to inspecting your cluster:</p>
          <div className="howto-list">
            {HOWTO.map((h) => (
              <div key={h.step} className="howto-row">
                <div className="howto-step">{h.step}</div>
                <div>
                  <div className="howto-title">{h.title}</div>
                  <div className="howto-text">{h.body}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="help-tip">
            Tip: the built-in <b>Demo Cluster</b> is always available — a safe place to try every
            feature before touching a real cluster.
          </p>
        </div>
      )}

      {tab === 'builtwith' && (
        <div className="help-body">
          <p>Open-source building blocks that power the app:</p>
          <div className="builtwith-grid">
            {BUILT_WITH.map((b) => (
              <div key={b.name} className="builtwith-row">
                <span className="bw-name">{b.name}</span>
                <span className="bw-role">{b.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="help-body">
          <ul className="sec-list">
            <li>
              <b>Credentials in the OS keychain.</b> Passwords are encrypted with your operating
              system keychain (macOS Keychain, Windows DPAPI, or Linux libsecret) and stored only on
              this device — never in plain text.
            </li>
            <li>
              <b>Stays on your device.</b> Connection details live in a local database. Nothing is
              sent to any external service, and there is no telemetry or tracking.
            </li>
            <li>
              <b>Enterprise authentication.</b> Supports PLAINTEXT, SSL/TLS (with optional client
              certificates), SASL PLAIN/SCRAM, and AWS MSK IAM.
            </li>
            <li>
              <b>Isolated by design.</b> Secrets are only ever used in the background process and are
              decrypted at connect time — they never reach the interface layer.
            </li>
            <li>
              <b>Guarded actions.</b> Destructive operations — deleting a topic or group, resetting
              offsets — always require explicit confirmation first.
            </li>
          </ul>
        </div>
      )}

      {tab === 'reset' && (
        <div className="help-body">
          <div className="guard-banner danger">
            This permanently deletes <b>everything</b> stored on this device — all saved
            connections, encrypted credentials and settings — and returns the app to a fresh state.
            It cannot be undone.
          </div>
          <p>To continue, type <b>CONFIRM</b> (in capitals) below.</p>
          <input
            className="input"
            style={{ marginBottom: 14 }}
            placeholder="CONFIRM"
            value={confirmText}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <button
            className="btn danger"
            disabled={confirmText !== 'CONFIRM' || resetting}
            onClick={() => void resetApp()}
          >
            {resetting ? <span className="spin" /> : 'Clear everything & reset'}
          </button>
        </div>
      )}
    </Modal>
  )
}
