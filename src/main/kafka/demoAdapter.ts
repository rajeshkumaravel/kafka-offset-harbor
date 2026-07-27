import type {
  BrokerInfo,
  ConfigEntry,
  ConsumerGroupDetail,
  ConsumerGroupSummary,
  CreateTopicRequest,
  FetchMessagesRequest,
  FetchMessagesResult,
  KafkaMessage,
  ProduceRequest,
  ProduceResult,
  ResetOffsetsRequest,
  TopicDetail,
  TopicSummary
} from '@shared/types'
import type { ClusterAdapter } from './adapter'

interface DemoRecord {
  offset: number
  timestamp: number
  key: string | null
  value: string | null
  headers: { key: string; value: string }[]
}

interface DemoPartition {
  /** offsets below this were "retention-deleted" */
  earliest: number
  records: DemoRecord[]
}

interface DemoTopic {
  name: string
  partitions: DemoPartition[]
  configs: Record<string, string>
}

interface DemoGroup {
  groupId: string
  state: string
  members: number
  /** topic -> partition -> committed offset */
  committed: Map<string, Map<number, number>>
}

const b64 = (s: string): string => Buffer.from(s, 'utf8').toString('base64')

const PRODUCTS = ['keyboard', 'monitor', 'dock', 'webcam', 'headset', 'mouse', 'hub', 'stand']
const REGIONS = ['us-east', 'us-west', 'eu-central', 'ap-south']
const LEVELS = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG']

/** Deterministic pseudo-random so the demo cluster looks the same every launch */
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

export class DemoAdapter implements ClusterAdapter {
  private topicsMap = new Map<string, DemoTopic>()
  private groupsMap = new Map<string, DemoGroup>()
  private brokerList: BrokerInfo[] = [
    { nodeId: 101, host: 'demo-broker-1.internal', port: 9092, isController: true },
    { nodeId: 102, host: 'demo-broker-2.internal', port: 9092, isController: false },
    { nodeId: 103, host: 'demo-broker-3.internal', port: 9092, isController: false }
  ]

  constructor() {
    this.seed()
  }

  private seed(): void {
    const rand = rng(42)
    const now = Date.now()

    const mkTopic = (
      name: string,
      partitions: number,
      count: number,
      gen: (i: number, p: number) => Omit<DemoRecord, 'offset' | 'timestamp'>
    ): void => {
      const topic: DemoTopic = {
        name,
        partitions: Array.from({ length: partitions }, () => ({ earliest: 0, records: [] })),
        configs: {
          'cleanup.policy': 'delete',
          'retention.ms': '604800000',
          'max.message.bytes': '1048576',
          'min.insync.replicas': '2',
          'compression.type': 'producer'
        }
      }
      for (let i = 0; i < count; i++) {
        const p = i % partitions
        const part = topic.partitions[p]
        part.records.push({
          offset: part.records.length,
          timestamp: now - (count - i) * 9000 - Math.floor(rand() * 4000),
          ...gen(i, p)
        })
      }
      this.topicsMap.set(name, topic)
    }

    mkTopic('orders.created', 6, 480, (i) => {
      const product = PRODUCTS[Math.floor(rand() * PRODUCTS.length)]
      const qty = 1 + Math.floor(rand() * 5)
      return {
        key: `order-${1000 + i}`,
        value: JSON.stringify({
          orderId: 1000 + i,
          customerId: `C-${100 + Math.floor(rand() * 400)}`,
          product,
          quantity: qty,
          totalCents: qty * (1999 + Math.floor(rand() * 20000)),
          region: REGIONS[Math.floor(rand() * REGIONS.length)]
        }),
        headers: [
          { key: 'source', value: b64('order-service') },
          { key: 'schema-version', value: b64('3') }
        ]
      }
    })

    mkTopic('payments.processed', 3, 300, (i) => ({
      key: `pay-${5000 + i}`,
      value: JSON.stringify({
        paymentId: 5000 + i,
        orderId: 1000 + i,
        method: rand() > 0.4 ? 'card' : 'wallet',
        status: rand() > 0.06 ? 'CAPTURED' : 'DECLINED',
        amountCents: 1999 + Math.floor(rand() * 40000)
      }),
      headers: [{ key: 'source', value: b64('payment-service') }]
    }))

    mkTopic('user.events', 4, 360, (i) => {
      const kinds = ['login', 'logout', 'view_product', 'add_to_cart', 'checkout']
      return {
        key: `user-${100 + Math.floor(rand() * 400)}`,
        value: JSON.stringify({
          event: kinds[Math.floor(rand() * kinds.length)],
          sessionId: `s-${Math.floor(rand() * 1e8).toString(16)}`,
          ts: new Date(now - (360 - i) * 9000).toISOString()
        }),
        headers: []
      }
    })

    mkTopic('app.logs', 2, 240, () => {
      const level = LEVELS[Math.floor(rand() * LEVELS.length)]
      return {
        key: null,
        value: `${level} [api-gateway] request completed status=${rand() > 0.1 ? 200 : 500} latencyMs=${Math.floor(rand() * 900)}`,
        headers: [{ key: 'level', value: b64(level) }]
      }
    })

    // tombstones + compaction demo
    mkTopic('inventory.snapshots', 3, 120, (i) => ({
      key: `sku-${PRODUCTS[i % PRODUCTS.length]}`,
      value: i % 17 === 0 ? null : JSON.stringify({ inStock: Math.floor(rand() * 500), warehouse: REGIONS[i % REGIONS.length] }),
      headers: []
    }))
    const inv = this.topicsMap.get('inventory.snapshots')
    if (inv) inv.configs['cleanup.policy'] = 'compact'

    // simulate retention having trimmed old app.logs
    const logs = this.topicsMap.get('app.logs')
    if (logs) {
      for (const p of logs.partitions) p.earliest = 25
    }

    const mkGroup = (groupId: string, state: string, members: number, topicLags: Record<string, number>): void => {
      const committed = new Map<string, Map<number, number>>()
      for (const [topicName, lagPerPartition] of Object.entries(topicLags)) {
        const topic = this.topicsMap.get(topicName)
        if (!topic) continue
        const partMap = new Map<number, number>()
        topic.partitions.forEach((p, idx) => {
          const end = p.earliest + p.records.length
          partMap.set(idx, Math.max(p.earliest, end - lagPerPartition - Math.floor(rng(idx + 7)() * 3)))
        })
        committed.set(topicName, partMap)
      }
      this.groupsMap.set(groupId, { groupId, state, members, committed })
    }

    mkGroup('order-fulfillment-service', 'Stable', 3, { 'orders.created': 0 })
    mkGroup('payment-reconciler', 'Stable', 2, { 'payments.processed': 12 })
    mkGroup('analytics-pipeline', 'Stable', 4, { 'orders.created': 55, 'user.events': 140, 'payments.processed': 30 })
    mkGroup('audit-archiver', 'Empty', 0, { 'app.logs': 78, 'orders.created': 210 })
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async brokers(): Promise<BrokerInfo[]> {
    return this.brokerList
  }

  async topics(): Promise<TopicSummary[]> {
    return [...this.topicsMap.values()]
      .map((t) => ({
        name: t.name,
        internal: false,
        partitionCount: t.partitions.length,
        replicationFactor: 3
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  private topic(name: string): DemoTopic {
    const t = this.topicsMap.get(name)
    if (!t) throw new Error(`topic not found: ${name}`)
    return t
  }

  async topicDetail(name: string): Promise<TopicDetail> {
    const t = this.topic(name)
    let total = 0
    const partitions = t.partitions.map((p, idx) => {
      const latest = p.earliest + p.records.length
      total += p.records.length
      return {
        partition: idx,
        leader: this.brokerList[idx % 3].nodeId,
        replicas: [101, 102, 103],
        isr: [101, 102, 103],
        earliestOffset: String(p.earliest),
        latestOffset: String(latest)
      }
    })
    return {
      name,
      internal: false,
      partitionCount: partitions.length,
      replicationFactor: 3,
      partitions,
      messageCount: String(total)
    }
  }

  async topicConfigs(name: string): Promise<ConfigEntry[]> {
    return Object.entries(this.topic(name).configs)
      .map(([k, v]) => ({ name: k, value: v, isDefault: false, readOnly: false }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async groups(): Promise<ConsumerGroupSummary[]> {
    return [...this.groupsMap.values()]
      .map((g) => ({
        groupId: g.groupId,
        state: g.state,
        protocolType: 'consumer',
        memberCount: g.members
      }))
      .sort((a, b) => a.groupId.localeCompare(b.groupId))
  }

  async groupDetail(groupId: string): Promise<ConsumerGroupDetail> {
    const g = this.groupsMap.get(groupId)
    if (!g) throw new Error(`consumer group not found: ${groupId}`)
    const offsets: ConsumerGroupDetail['offsets'] = []
    const memberAssignments: { topic: string; partitions: number[] }[] = []
    for (const [topicName, partMap] of g.committed) {
      const t = this.topicsMap.get(topicName)
      if (!t) continue
      memberAssignments.push({
        topic: topicName,
        partitions: t.partitions.map((_, i) => i)
      })
      for (const [partition, committed] of [...partMap.entries()].sort((a, b) => a[0] - b[0])) {
        const p = t.partitions[partition]
        const latest = p.earliest + p.records.length
        offsets.push({
          topic: topicName,
          partition,
          committedOffset: String(committed),
          earliestOffset: String(p.earliest),
          latestOffset: String(latest),
          lag: String(Math.max(0, latest - committed))
        })
      }
    }
    offsets.sort((a, b) => a.topic.localeCompare(b.topic) || a.partition - b.partition)
    const members = Array.from({ length: g.members }, (_, i) => ({
      memberId: `${g.groupId}-member-${i + 1}-${(1e8 * (i + 1)).toString(16)}`,
      clientId: `${g.groupId}-client-${i + 1}`,
      clientHost: `/10.0.${i + 1}.${20 + i * 3}`,
      assignedPartitions: memberAssignments
    }))
    return {
      groupId,
      state: g.state,
      protocolType: 'consumer',
      memberCount: g.members,
      members,
      offsets
    }
  }

  async fetchMessages(req: FetchMessagesRequest): Promise<FetchMessagesResult> {
    const started = Date.now()
    const t = this.topic(req.topic)
    const parts =
      req.partition === null
        ? t.partitions.map((p, i) => [i, p] as const)
        : ([[req.partition, t.partitions[req.partition]]] as const)
    if (req.partition !== null && !t.partitions[req.partition]) {
      throw new Error(`partition not found on topic ${req.topic}`)
    }

    const collected: KafkaMessage[] = []
    for (const [idx, p] of parts) {
      const latest = p.earliest + p.records.length
      let start: number
      if (req.from === 'oldest') start = p.earliest
      else if (req.from === 'newest') start = Math.max(p.earliest, latest - req.maxMessages)
      else if (req.from === 'timestamp') {
        const ts = req.startTimestamp ?? 0
        const found = p.records.find((r) => r.timestamp >= ts)
        start = found ? found.offset : latest
      } else start = Math.min(Math.max(Number(req.startOffset ?? 0), p.earliest), latest)
      for (const r of p.records.slice(Math.max(0, start - p.earliest))) {
        collected.push({
          topic: req.topic,
          partition: idx,
          offset: String(r.offset),
          timestamp: String(r.timestamp),
          key: r.key === null ? null : b64(r.key),
          value: r.value === null ? null : b64(r.value),
          headers: r.headers,
          keySize: r.key?.length ?? 0,
          valueSize: r.value?.length ?? 0
        })
      }
    }
    collected.sort(
      (a, b) => a.partition - b.partition || Number(a.offset) - Number(b.offset)
    )
    const truncated = collected.length > req.maxMessages
    const messages =
      req.from === 'newest' ? collected.slice(-req.maxMessages) : collected.slice(0, req.maxMessages)
    return { messages, truncated, durationMs: Date.now() - started + 40 }
  }

  async produce(req: ProduceRequest): Promise<ProduceResult> {
    const t = this.topic(req.topic)
    const count = Math.max(1, req.repeat)
    const firstOffsets = new Map<number, string>()
    for (let i = 0; i < count; i++) {
      const partition =
        req.partition ?? (req.key ? hashCode(req.key) % t.partitions.length : i % t.partitions.length)
      const p = t.partitions[partition]
      if (!p) throw new Error(`partition ${partition} not found`)
      const offset = p.earliest + p.records.length
      p.records.push({
        offset,
        timestamp: Date.now(),
        key: req.key,
        value: req.value,
        headers: req.headers.map((h) => ({ key: h.key, value: b64(h.value) }))
      })
      if (!firstOffsets.has(partition)) firstOffsets.set(partition, String(offset))
    }
    return {
      count,
      firstOffsets: [...firstOffsets.entries()].map(([partition, baseOffset]) => ({
        partition,
        baseOffset
      }))
    }
  }

  async resetOffsets(req: ResetOffsetsRequest): Promise<void> {
    const g = this.groupsMap.get(req.groupId)
    if (!g) throw new Error(`consumer group not found: ${req.groupId}`)
    if (g.members > 0) throw new Error('offsets can only be reset while the group has no active members')
    const t = this.topic(req.topic)
    const partMap = g.committed.get(req.topic) ?? new Map<number, number>()
    g.committed.set(req.topic, partMap)
    const targets = req.partition === null ? t.partitions.map((_, i) => i) : [req.partition]
    for (const partition of targets) {
      const p = t.partitions[partition]
      const latest = p.earliest + p.records.length
      let next: number
      if (req.target === 'earliest') next = p.earliest
      else if (req.target === 'latest') next = latest
      else if (req.target === 'timestamp') {
        const found = p.records.find((r) => r.timestamp >= (req.timestamp ?? 0))
        next = found ? found.offset : latest
      } else next = Math.min(Math.max(Number(req.offset ?? 0), p.earliest), latest)
      partMap.set(partition, next)
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    const g = this.groupsMap.get(groupId)
    if (!g) throw new Error(`consumer group not found: ${groupId}`)
    if (g.members > 0) throw new Error('cannot delete a group with active members')
    this.groupsMap.delete(groupId)
  }

  async createTopic(req: CreateTopicRequest): Promise<void> {
    if (this.topicsMap.has(req.name)) throw new Error(`topic ${req.name} already exists`)
    this.topicsMap.set(req.name, {
      name: req.name,
      partitions: Array.from({ length: req.numPartitions }, () => ({ earliest: 0, records: [] })),
      configs: Object.fromEntries(req.configs.map((c) => [c.name, c.value]))
    })
  }

  async deleteTopic(topic: string): Promise<void> {
    if (!this.topicsMap.delete(topic)) throw new Error(`topic not found: ${topic}`)
    for (const g of this.groupsMap.values()) g.committed.delete(topic)
  }

  async addPartitions(topic: string, totalCount: number): Promise<void> {
    const t = this.topic(topic)
    if (totalCount <= t.partitions.length) {
      throw new Error(`topic already has ${t.partitions.length} partitions`)
    }
    while (t.partitions.length < totalCount) t.partitions.push({ earliest: 0, records: [] })
  }

  async setTopicConfig(topic: string, name: string, value: string): Promise<void> {
    this.topic(topic).configs[name] = value
  }
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
