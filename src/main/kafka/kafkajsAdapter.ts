import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  Kafka,
  ConfigResourceTypes,
  logLevel,
  type Admin,
  type KafkaConfig,
  type SASLOptions,
  type IHeaders
} from 'kafkajs'
import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js'
import type {
  BrokerInfo,
  ClusterProfile,
  ConfigEntry,
  ConsumerGroupDetail,
  ConsumerGroupSummary,
  CreateTopicRequest,
  FetchMessagesRequest,
  FetchMessagesResult,
  GroupOffsetRow,
  KafkaMessage,
  MessageHeader,
  ProduceRequest,
  ProduceResult,
  ResetOffsetsRequest,
  TopicDetail,
  TopicSummary
} from '@shared/types'
import type { ClusterAdapter } from './adapter'

function buildSasl(profile: ClusterProfile, password: string | null): SASLOptions | undefined {
  const sasl = profile.sasl
  if (!sasl) return undefined
  if (sasl.mechanism === 'aws-msk-iam') {
    const region = sasl.awsRegion || process.env.AWS_REGION || 'us-east-1'
    return {
      mechanism: 'oauthbearer',
      oauthBearerProvider: async () => {
        const { token } = await generateAuthToken({ region })
        return { value: token }
      }
    }
  }
  if (!sasl.username || password === null) {
    throw new Error('SASL username/password required — edit the connection and re-enter the password')
  }
  return {
    mechanism: sasl.mechanism,
    username: sasl.username,
    password
  } as SASLOptions
}

function buildConfig(profile: ClusterProfile, password: string | null): KafkaConfig {
  const useSsl = profile.securityProtocol === 'SSL' || profile.securityProtocol === 'SASL_SSL'
  const useSasl =
    profile.securityProtocol === 'SASL_PLAINTEXT' || profile.securityProtocol === 'SASL_SSL'
  let ssl: KafkaConfig['ssl'] = undefined
  if (useSsl) {
    const cfg = profile.ssl
    ssl = {
      rejectUnauthorized: cfg?.rejectUnauthorized ?? true,
      ca: cfg?.caPath ? [readFileSync(cfg.caPath, 'utf8')] : undefined,
      cert: cfg?.certPath ? readFileSync(cfg.certPath, 'utf8') : undefined,
      key: cfg?.keyPath ? readFileSync(cfg.keyPath, 'utf8') : undefined
    }
  }
  return {
    clientId: 'kafka-offset-harbor',
    brokers: profile.bootstrapServers.split(',').map((s) => s.trim()).filter(Boolean),
    ssl,
    sasl: useSasl ? buildSasl(profile, password) : undefined,
    connectionTimeout: Math.min(profile.requestTimeoutMs, 10000),
    requestTimeout: profile.requestTimeoutMs,
    retry: { retries: 2 },
    logLevel: logLevel.NOTHING
  }
}

function decodeHeaders(headers: IHeaders | undefined): MessageHeader[] {
  if (!headers) return []
  return Object.entries(headers).map(([key, value]) => ({
    key,
    value: Buffer.isBuffer(value)
      ? value.toString('base64')
      : Buffer.from(String(value ?? '')).toString('base64')
  }))
}

export class KafkaJsAdapter implements ClusterAdapter {
  private kafka: Kafka
  private admin: Admin
  private connected = false

  constructor(private profile: ClusterProfile, password: string | null) {
    this.kafka = new Kafka(buildConfig(profile, password))
    this.admin = this.kafka.admin()
  }

  async connect(): Promise<void> {
    if (this.connected) return
    await this.admin.connect()
    // fail fast on unreachable/unauthorized clusters instead of on first use
    await this.admin.describeCluster()
    this.connected = true
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return
    await this.admin.disconnect()
    this.connected = false
  }

  async brokers(): Promise<BrokerInfo[]> {
    const { brokers, controller } = await this.admin.describeCluster()
    return brokers
      .map((b) => ({
        nodeId: b.nodeId,
        host: b.host,
        port: b.port,
        isController: b.nodeId === controller
      }))
      .sort((a, b) => a.nodeId - b.nodeId)
  }

  async topics(): Promise<TopicSummary[]> {
    const meta = await this.admin.fetchTopicMetadata()
    return meta.topics
      .map((t) => ({
        name: t.name,
        internal: t.name.startsWith('__'),
        partitionCount: t.partitions.length,
        replicationFactor: t.partitions[0]?.replicas.length ?? 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async topicDetail(topic: string): Promise<TopicDetail> {
    const [meta, offsets] = await Promise.all([
      this.admin.fetchTopicMetadata({ topics: [topic] }),
      this.admin.fetchTopicOffsets(topic)
    ])
    const t = meta.topics[0]
    if (!t) throw new Error(`topic not found: ${topic}`)
    const byPartition = new Map(offsets.map((o) => [o.partition, o]))
    let total = 0n
    const partitions = t.partitions
      .map((p) => {
        const off = byPartition.get(p.partitionId)
        const earliest = off?.low ?? '0'
        const latest = off?.high ?? '0'
        total += BigInt(latest) - BigInt(earliest)
        return {
          partition: p.partitionId,
          leader: p.leader,
          replicas: p.replicas,
          isr: p.isr,
          earliestOffset: earliest,
          latestOffset: latest
        }
      })
      .sort((a, b) => a.partition - b.partition)
    return {
      name: t.name,
      internal: t.name.startsWith('__'),
      partitionCount: partitions.length,
      replicationFactor: t.partitions[0]?.replicas.length ?? 0,
      partitions,
      messageCount: total.toString()
    }
  }

  async topicConfigs(topic: string): Promise<ConfigEntry[]> {
    const res = await this.admin.describeConfigs({
      includeSynonyms: false,
      resources: [{ type: ConfigResourceTypes.TOPIC, name: topic }]
    })
    const entries = res.resources[0]?.configEntries ?? []
    return entries
      .map((e) => ({
        name: e.configName,
        value: e.configValue ?? null,
        isDefault: e.isDefault,
        readOnly: e.readOnly
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async groups(): Promise<ConsumerGroupSummary[]> {
    const { groups } = await this.admin.listGroups()
    if (groups.length === 0) return []
    const described = await this.admin.describeGroups(groups.map((g) => g.groupId))
    return described.groups
      .map((g) => ({
        groupId: g.groupId,
        state: g.state,
        protocolType: g.protocolType,
        memberCount: g.members.length
      }))
      .sort((a, b) => a.groupId.localeCompare(b.groupId))
  }

  async groupDetail(groupId: string): Promise<ConsumerGroupDetail> {
    const described = await this.admin.describeGroups([groupId])
    const g = described.groups[0]
    if (!g) throw new Error(`consumer group not found: ${groupId}`)

    const members = g.members.map((m) => {
      let assigned: { topic: string; partitions: number[] }[] = []
      try {
        assigned = decodeMemberAssignment(m.memberAssignment)
      } catch {
        // non-standard assignment encoding (e.g. connect protocol) — leave empty
      }
      return {
        memberId: m.memberId,
        clientId: m.clientId,
        clientHost: m.clientHost,
        assignedPartitions: assigned
      }
    })

    const fetched = await this.admin.fetchOffsets({ groupId })
    const offsets: GroupOffsetRow[] = []
    for (const t of fetched) {
      // negative offsets are "nothing committed" (-1) or unresolved sentinels (-2)
      const committed = t.partitions.filter((p) => !p.offset.startsWith('-'))
      if (committed.length === 0) continue
      const topicOffsets = await this.admin.fetchTopicOffsets(t.topic)
      const byPartition = new Map(topicOffsets.map((o) => [o.partition, o]))
      for (const p of committed.sort((a, b) => a.partition - b.partition)) {
        const range = byPartition.get(p.partition)
        const latest = range?.high ?? '0'
        const lag = BigInt(latest) - BigInt(p.offset)
        offsets.push({
          topic: t.topic,
          partition: p.partition,
          committedOffset: p.offset,
          earliestOffset: range?.low ?? '0',
          latestOffset: latest,
          lag: (lag < 0n ? 0n : lag).toString()
        })
      }
    }
    offsets.sort((a, b) => a.topic.localeCompare(b.topic) || a.partition - b.partition)

    return {
      groupId: g.groupId,
      state: g.state,
      protocolType: g.protocolType,
      memberCount: g.members.length,
      members,
      offsets
    }
  }

  async fetchMessages(req: FetchMessagesRequest): Promise<FetchMessagesResult> {
    const started = Date.now()
    const topicOffsets = await this.admin.fetchTopicOffsets(req.topic)
    const wanted = topicOffsets
      .filter((o) => req.partition === null || o.partition === req.partition)
      .sort((a, b) => a.partition - b.partition)
    if (wanted.length === 0) throw new Error(`partition not found on topic ${req.topic}`)

    // starting offset per partition
    const starts = new Map<number, bigint>()
    if (req.from === 'timestamp' && req.startTimestamp !== undefined) {
      const byTs = await this.admin.fetchTopicOffsetsByTimestamp(req.topic, req.startTimestamp)
      const map = new Map(byTs.map((o) => [o.partition, o.offset]))
      for (const o of wanted) starts.set(o.partition, BigInt(map.get(o.partition) ?? o.high))
    } else {
      for (const o of wanted) {
        const low = BigInt(o.low)
        const high = BigInt(o.high)
        let start: bigint
        if (req.from === 'oldest') start = low
        else if (req.from === 'newest') start = high - BigInt(req.maxMessages)
        else start = BigInt(req.startOffset ?? '0')
        if (start < low) start = low
        if (start > high) start = high
        starts.set(o.partition, start)
      }
    }

    // per-partition end (exclusive) and remaining budget
    const ends = new Map(wanted.map((o) => [o.partition, BigInt(o.high)]))
    const pending = new Set(
      wanted.filter((o) => (starts.get(o.partition) ?? 0n) < (ends.get(o.partition) ?? 0n)).map((o) => o.partition)
    )
    const messages: KafkaMessage[] = []
    if (pending.size === 0) {
      return { messages, truncated: false, durationMs: Date.now() - started }
    }

    // 'newest' needs a window per partition; otherwise maxMessages total is enough
    const budget =
      req.from === 'newest' && req.partition === null
        ? req.maxMessages * wanted.length
        : req.maxMessages

    const groupId = `kafka-offset-harbor-peek-${randomUUID()}`
    const consumer = this.kafka.consumer({ groupId, maxWaitTimeInMs: 500 })
    let truncated = false
    try {
      await consumer.connect()
      await consumer.subscribe({ topic: req.topic, fromBeginning: true })

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), 30000)
        const finish = (): void => {
          clearTimeout(timer)
          resolve()
        }
        consumer
          .run({
            autoCommit: false,
            eachBatchAutoResolve: true,
            eachBatch: async ({ batch }) => {
              if (!pending.has(batch.partition)) return
              const start = starts.get(batch.partition) ?? 0n
              const end = ends.get(batch.partition) ?? 0n
              for (const m of batch.messages) {
                const off = BigInt(m.offset)
                if (off < start) continue
                if (off >= end) break
                messages.push({
                  topic: req.topic,
                  partition: batch.partition,
                  offset: m.offset,
                  timestamp: m.timestamp,
                  key: m.key ? m.key.toString('base64') : null,
                  value: m.value ? m.value.toString('base64') : null,
                  headers: decodeHeaders(m.headers),
                  keySize: m.key?.length ?? 0,
                  valueSize: m.value?.length ?? 0
                })
                if (messages.length >= budget) return finish()
              }
              const nextOffset = BigInt(batch.lastOffset()) + 1n
              if (nextOffset >= end) {
                pending.delete(batch.partition)
                if (pending.size === 0) finish()
              }
            }
          })
          .then(() => {
            // seek every wanted partition to its computed start
            for (const [partition, start] of starts) {
              consumer.seek({ topic: req.topic, partition, offset: start.toString() })
            }
          })
          .catch((err) => {
            clearTimeout(timer)
            reject(err)
          })
      })
    } finally {
      await consumer.disconnect().catch(() => {})
      await this.admin.deleteGroups([groupId]).catch(() => {})
    }

    // stable order: offset asc within partition, partitions interleaved by timestamp
    messages.sort(
      (a, b) => a.partition - b.partition || (BigInt(a.offset) < BigInt(b.offset) ? -1 : 1)
    )
    let result = messages
    if (result.length > req.maxMessages) {
      truncated = true
      result = req.from === 'newest' ? result.slice(-req.maxMessages) : result.slice(0, req.maxMessages)
    }
    return { messages: result, truncated, durationMs: Date.now() - started }
  }

  async produce(req: ProduceRequest): Promise<ProduceResult> {
    const producer = this.kafka.producer({ allowAutoTopicCreation: false })
    await producer.connect()
    try {
      const headers: IHeaders = {}
      for (const h of req.headers) headers[h.key] = h.value
      const messages = Array.from({ length: Math.max(1, req.repeat) }, () => ({
        partition: req.partition ?? undefined,
        key: req.key === null ? null : Buffer.from(req.key, 'utf8'),
        value: req.value === null ? null : Buffer.from(req.value, 'utf8'),
        headers
      }))
      const meta = await producer.send({ topic: req.topic, messages })
      return {
        count: messages.length,
        firstOffsets: meta.map((m) => ({
          partition: m.partition,
          baseOffset: m.baseOffset ?? '0'
        }))
      }
    } finally {
      await producer.disconnect().catch(() => {})
    }
  }

  async resetOffsets(req: ResetOffsetsRequest): Promise<void> {
    if (req.target === 'earliest' || req.target === 'latest') {
      // Always commit concrete offsets. admin.resetOffsets would commit the
      // -2/-1 sentinels, which other tools display as "no committed offset".
      const offsets = await this.admin.fetchTopicOffsets(req.topic)
      const partitions = offsets
        .filter((o) => req.partition === null || o.partition === req.partition)
        .map((o) => ({ partition: o.partition, offset: req.target === 'earliest' ? o.low : o.high }))
      if (partitions.length === 0) {
        throw new Error(`partition ${req.partition} not found on ${req.topic}`)
      }
      await this.admin.setOffsets({ groupId: req.groupId, topic: req.topic, partitions })
      return
    }
    if (req.target === 'timestamp') {
      const byTs = await this.admin.fetchTopicOffsetsByTimestamp(req.topic, req.timestamp)
      const partitions = byTs
        .filter((o) => req.partition === null || o.partition === req.partition)
        .map((o) => ({ partition: o.partition, offset: o.offset }))
      await this.admin.setOffsets({ groupId: req.groupId, topic: req.topic, partitions })
      return
    }
    // specific offset
    if (req.offset === undefined) throw new Error('offset required')
    const partitions =
      req.partition !== null
        ? [{ partition: req.partition, offset: req.offset }]
        : (await this.admin.fetchTopicOffsets(req.topic)).map((o) => ({
            partition: o.partition,
            offset: req.offset as string
          }))
    await this.admin.setOffsets({ groupId: req.groupId, topic: req.topic, partitions })
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.admin.deleteGroups([groupId])
  }

  async createTopic(req: CreateTopicRequest): Promise<void> {
    const ok = await this.admin.createTopics({
      topics: [
        {
          topic: req.name,
          numPartitions: req.numPartitions,
          replicationFactor: req.replicationFactor,
          configEntries: req.configs.map((c) => ({ name: c.name, value: c.value }))
        }
      ]
    })
    if (!ok) throw new Error(`topic ${req.name} already exists`)
  }

  async deleteTopic(topic: string): Promise<void> {
    await this.admin.deleteTopics({ topics: [topic] })
  }

  async addPartitions(topic: string, totalCount: number): Promise<void> {
    await this.admin.createPartitions({
      topicPartitions: [{ topic, count: totalCount }]
    })
  }

  async setTopicConfig(topic: string, name: string, value: string): Promise<void> {
    await this.admin.alterConfigs({
      validateOnly: false,
      resources: [
        { type: ConfigResourceTypes.TOPIC, name: topic, configEntries: [{ name, value }] }
      ]
    })
  }
}

/**
 * Decode the standard consumer protocol MemberAssignment buffer:
 * version(int16), topics array [name(string), partitions array int32], userdata(bytes)
 */
function decodeMemberAssignment(buf: Buffer): { topic: string; partitions: number[] }[] {
  if (!buf || buf.length < 8) return []
  let pos = 2 // skip version
  const topicCount = buf.readInt32BE(pos)
  pos += 4
  const out: { topic: string; partitions: number[] }[] = []
  for (let i = 0; i < topicCount; i++) {
    const nameLen = buf.readInt16BE(pos)
    pos += 2
    const topic = buf.subarray(pos, pos + nameLen).toString('utf8')
    pos += nameLen
    const partCount = buf.readInt32BE(pos)
    pos += 4
    const partitions: number[] = []
    for (let j = 0; j < partCount; j++) {
      partitions.push(buf.readInt32BE(pos))
      pos += 4
    }
    out.push({ topic, partitions: partitions.sort((a, b) => a - b) })
  }
  return out
}
