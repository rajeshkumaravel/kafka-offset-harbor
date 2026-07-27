import type { ClusterProfile, ClusterProfileInput, TestConnectionResult } from '@shared/types'
import type { ClusterAdapter } from './adapter'
import { DemoAdapter } from './demoAdapter'
import { KafkaJsAdapter } from './kafkajsAdapter'
import { getPassword, getProfile } from '../store/sqlite'

/** One live adapter per connected profile; demo adapter is created once and kept. */
const adapters = new Map<string, ClusterAdapter>()

export async function getAdapter(profileId: string): Promise<ClusterAdapter> {
  const existing = adapters.get(profileId)
  if (existing) return existing
  const profile = getProfile(profileId)
  const adapter: ClusterAdapter = profile.isDemo
    ? new DemoAdapter()
    : new KafkaJsAdapter(profile, getPassword(profileId))
  await adapter.connect()
  adapters.set(profileId, adapter)
  return adapter
}

export async function disconnect(profileId: string): Promise<void> {
  const adapter = adapters.get(profileId)
  if (!adapter) return
  adapters.delete(profileId)
  await adapter.disconnect()
}

export async function disconnectAll(): Promise<void> {
  await Promise.allSettled([...adapters.keys()].map((id) => disconnect(id)))
}

/** Test connectivity with a transient adapter that never enters the cache. */
export async function testConnection(
  input: ClusterProfileInput,
  existingId: string | null
): Promise<TestConnectionResult> {
  if (existingId) {
    const existing = getProfile(existingId)
    if (existing.isDemo) return { ok: true, message: 'demo cluster is always available', brokerCount: 3 }
  }
  const transient: ClusterProfile = {
    id: existingId ?? 'transient-test',
    name: input.name || 'unsaved connection',
    bootstrapServers: input.bootstrapServers,
    securityProtocol: input.securityProtocol,
    sasl: input.sasl ? { ...input.sasl, hasPassword: !!input.sasl.password } : undefined,
    ssl: input.ssl,
    requestTimeoutMs: input.requestTimeoutMs,
    color: input.color,
    isDemo: false,
    createdAt: new Date().toISOString()
  }
  const password = input.sasl?.password ?? (existingId ? getPassword(existingId) : null)
  const adapter = new KafkaJsAdapter(transient, password)
  try {
    await adapter.connect()
    const brokers = await adapter.brokers()
    const controller = brokers.find((b) => b.isController)
    return {
      ok: true,
      message: `connected — ${brokers.length} broker${brokers.length === 1 ? '' : 's'}`,
      brokerCount: brokers.length,
      controllerId: controller?.nodeId
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  } finally {
    await adapter.disconnect().catch(() => {})
  }
}
