import { useState } from 'react'
import type { ClusterProfile, ClusterProfileInput, SaslMechanism, SecurityProtocol, TestConnectionResult } from '@shared/types'
import { useStore } from '../../state/store'
import Modal from './Modal'

const api = window.api

const EMPTY: ClusterProfileInput = {
  name: '',
  bootstrapServers: 'localhost:9092',
  securityProtocol: 'PLAINTEXT',
  requestTimeoutMs: 30000,
  color: 'none'
}

function toInput(p: ClusterProfile): ClusterProfileInput {
  return {
    name: p.name,
    bootstrapServers: p.bootstrapServers,
    securityProtocol: p.securityProtocol,
    sasl: p.sasl ? { mechanism: p.sasl.mechanism, username: p.sasl.username, awsRegion: p.sasl.awsRegion } : undefined,
    ssl: p.ssl,
    requestTimeoutMs: p.requestTimeoutMs,
    color: p.color
  }
}

export default function ConnectionsDialog(): React.JSX.Element {
  const profiles = useStore((s) => s.profiles)
  const refreshProfiles = useStore((s) => s.refreshProfiles)
  const selectProfile = useStore((s) => s.selectProfile)
  const setShowConnections = useStore((s) => s.setShowConnections)
  const showToast = useStore((s) => s.showToast)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClusterProfileInput | null>(null)
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const close = (): void => setShowConnections(false)
  const patch = (p: Partial<ClusterProfileInput>): void => {
    setForm((f) => (f ? { ...f, ...p } : f))
    setTestResult(null)
  }

  const needsSasl = form && (form.securityProtocol === 'SASL_PLAINTEXT' || form.securityProtocol === 'SASL_SSL')
  const needsSsl = form && (form.securityProtocol === 'SSL' || form.securityProtocol === 'SASL_SSL')
  const isIam = needsSasl && form?.sasl?.mechanism === 'aws-msk-iam'

  const save = async (): Promise<void> => {
    if (!form) return
    if (!form.name.trim() || !form.bootstrapServers.trim()) {
      showToast('error', 'name and bootstrap servers are required')
      return
    }
    setSaving(true)
    try {
      const saved = editingId
        ? await api.invoke('profiles:update', editingId, form)
        : await api.invoke('profiles:create', form)
      await refreshProfiles()
      setForm(null)
      setEditingId(null)
      showToast('info', `saved connection ${saved.name}`)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Cluster connections" onClose={close} wide>
      {!form ? (
        <>
          <div className="profile-list">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="profile-row"
                onClick={() => {
                  void selectProfile(p.id)
                  close()
                }}
              >
                <span className="name">{p.name}</span>
                <span className="host">{p.isDemo ? 'in-memory demo' : p.bootstrapServers}</span>
                <span className="host">{p.securityProtocol}</span>
                {!p.isDemo && (
                  <>
                    <button
                      className="btn small ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId(p.id)
                        setForm(toInput(p))
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn small ghost"
                      style={{ color: 'var(--danger)' }}
                      onClick={async (e) => {
                        e.stopPropagation()
                        await api.invoke('profiles:delete', p.id)
                        await refreshProfiles()
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{ paddingBottom: 14 }}>
            <button
              className="btn primary"
              onClick={() => {
                setEditingId(null)
                setForm({ ...EMPTY })
              }}
            >
              + New connection
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field-row">
            <div className="field">
              <label>Name</label>
              <input className="input" value={form.name} onChange={(e) => patch({ name: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label>Environment badge</label>
              <select
                className="select"
                value={form.color}
                onChange={(e) => patch({ color: e.target.value as ClusterProfileInput['color'] })}
              >
                <option value="none">none</option>
                <option value="blue">dev (blue)</option>
                <option value="amber">stage (amber)</option>
                <option value="red">prod (red)</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Bootstrap servers (comma-separated host:port)</label>
            <input
              className="input"
              value={form.bootstrapServers}
              onChange={(e) => patch({ bootstrapServers: e.target.value })}
              placeholder="broker1:9092, broker2:9092"
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Security protocol</label>
              <select
                className="select"
                value={form.securityProtocol}
                onChange={(e) => {
                  const sp = e.target.value as SecurityProtocol
                  patch({
                    securityProtocol: sp,
                    sasl:
                      sp === 'SASL_PLAINTEXT' || sp === 'SASL_SSL'
                        ? form.sasl ?? { mechanism: 'plain' }
                        : undefined,
                    ssl:
                      sp === 'SSL' || sp === 'SASL_SSL'
                        ? form.ssl ?? { rejectUnauthorized: true }
                        : undefined
                  })
                }}
              >
                <option value="PLAINTEXT">PLAINTEXT</option>
                <option value="SSL">SSL</option>
                <option value="SASL_PLAINTEXT">SASL_PLAINTEXT</option>
                <option value="SASL_SSL">SASL_SSL</option>
              </select>
            </div>
            <div className="field">
              <label>Request timeout (ms)</label>
              <input
                className="input"
                value={String(form.requestTimeoutMs)}
                onChange={(e) => patch({ requestTimeoutMs: Number(e.target.value.replace(/[^0-9]/g, '')) || 30000 })}
              />
            </div>
          </div>

          {needsSasl && (
            <>
              <div className="field">
                <label>SASL mechanism</label>
                <select
                  className="select"
                  value={form.sasl?.mechanism ?? 'plain'}
                  onChange={(e) =>
                    patch({ sasl: { ...form.sasl, mechanism: e.target.value as SaslMechanism } })
                  }
                >
                  <option value="plain">PLAIN</option>
                  <option value="scram-sha-256">SCRAM-SHA-256</option>
                  <option value="scram-sha-512">SCRAM-SHA-512</option>
                  <option value="aws-msk-iam">AWS MSK IAM</option>
                </select>
              </div>
              {isIam ? (
                <div className="field">
                  <label>AWS region</label>
                  <input
                    className="input"
                    value={form.sasl?.awsRegion ?? ''}
                    placeholder="us-east-1 (uses your default AWS credentials chain)"
                    onChange={(e) =>
                      patch({ sasl: { mechanism: 'aws-msk-iam', awsRegion: e.target.value } })
                    }
                  />
                </div>
              ) : (
                <div className="field-row">
                  <div className="field">
                    <label>Username</label>
                    <input
                      className="input"
                      value={form.sasl?.username ?? ''}
                      onChange={(e) =>
                        patch({
                          sasl: { mechanism: form.sasl?.mechanism ?? 'plain', ...form.sasl, username: e.target.value }
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Password {editingId ? '(leave blank to keep saved)' : ''}</label>
                    <input
                      className="input"
                      type="password"
                      value={form.sasl?.password ?? ''}
                      onChange={(e) =>
                        patch({
                          sasl: { mechanism: form.sasl?.mechanism ?? 'plain', ...form.sasl, password: e.target.value }
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {needsSsl && (
            <>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.ssl?.rejectUnauthorized ?? true}
                  onChange={(e) =>
                    patch({ ssl: { ...form.ssl, rejectUnauthorized: e.target.checked } })
                  }
                />
                Verify broker certificate (uncheck for self-signed dev clusters)
              </label>
              <div className="field-row">
                <div className="field">
                  <label>CA cert path (PEM, optional)</label>
                  <input
                    className="input"
                    value={form.ssl?.caPath ?? ''}
                    onChange={(e) =>
                      patch({ ssl: { rejectUnauthorized: true, ...form.ssl, caPath: e.target.value || undefined } })
                    }
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Client cert path (optional)</label>
                  <input
                    className="input"
                    value={form.ssl?.certPath ?? ''}
                    onChange={(e) =>
                      patch({ ssl: { rejectUnauthorized: true, ...form.ssl, certPath: e.target.value || undefined } })
                    }
                  />
                </div>
                <div className="field">
                  <label>Client key path (optional)</label>
                  <input
                    className="input"
                    value={form.ssl?.keyPath ?? ''}
                    onChange={(e) =>
                      patch({ ssl: { rejectUnauthorized: true, ...form.ssl, keyPath: e.target.value || undefined } })
                    }
                  />
                </div>
              </div>
            </>
          )}

          <div className="secure-note">
            <span className="lock" aria-hidden>
              🔒
            </span>
            <span>
              {isIam
                ? 'No password is stored — this connection authenticates with your local AWS credentials at connect time.'
                : needsSasl
                  ? 'Your password is encrypted with your operating system keychain (macOS Keychain, Windows DPAPI, or Linux libsecret) and stored only on this device. It never leaves your machine and is never sent anywhere except your Kafka brokers.'
                  : 'Connection details are stored locally on this device only — nothing is sent to any external service.'}
            </span>
          </div>

          {testResult && (
            <div className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}>{testResult.message}</div>
          )}

          <div className="modal-footer" style={{ padding: '4px 0 16px' }}>
            <button
              className="btn"
              disabled={testing}
              onClick={async () => {
                setTesting(true)
                setTestResult(null)
                try {
                  setTestResult(await api.invoke('profiles:test', form, editingId))
                } catch (err) {
                  setTestResult({ ok: false, message: err instanceof Error ? err.message : String(err) })
                } finally {
                  setTesting(false)
                }
              }}
            >
              {testing ? <span className="spin" /> : 'Test connection'}
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn ghost" onClick={() => setForm(null)}>
              Back
            </button>
            <button className="btn primary" disabled={saving} onClick={() => void save()}>
              {saving ? <span className="spin" /> : editingId ? 'Save changes' : 'Create connection'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
