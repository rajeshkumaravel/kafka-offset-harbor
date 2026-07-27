/** Security protocols supported for cluster connections */
export type SecurityProtocol = 'PLAINTEXT' | 'SSL' | 'SASL_PLAINTEXT' | 'SASL_SSL'
export type SaslMechanism = 'plain' | 'scram-sha-256' | 'scram-sha-512' | 'aws-msk-iam'

export interface SaslConfig {
  mechanism: SaslMechanism
  username?: string
  /** Never persisted in plaintext; stored encrypted via safeStorage */
  password?: string
  /** aws-msk-iam only */
  awsRegion?: string
  awsProfile?: string
}

export interface SslConfig {
  /** Skip broker certificate validation (self-signed dev clusters) */
  rejectUnauthorized: boolean
  /** PEM file paths, optional */
  caPath?: string
  certPath?: string
  keyPath?: string
}

export interface ClusterProfileInput {
  name: string
  /** comma-separated host:port list */
  bootstrapServers: string
  securityProtocol: SecurityProtocol
  sasl?: SaslConfig
  ssl?: SslConfig
  requestTimeoutMs: number
  color: 'none' | 'blue' | 'amber' | 'red'
}

export interface ClusterProfile extends Omit<ClusterProfileInput, 'sasl'> {
  id: string
  isDemo: boolean
  sasl?: Omit<SaslConfig, 'password'> & { hasPassword: boolean }
  createdAt: string
}

export interface TestConnectionResult {
  ok: boolean
  message: string
  brokerCount?: number
  controllerId?: number
}

/** ---- cluster metadata ---- */
export interface BrokerInfo {
  nodeId: number
  host: string
  port: number
  isController: boolean
}

export interface PartitionInfo {
  partition: number
  leader: number
  replicas: number[]
  isr: number[]
  earliestOffset: string
  latestOffset: string
}

export interface TopicSummary {
  name: string
  internal: boolean
  partitionCount: number
  replicationFactor: number
}

export interface TopicDetail extends TopicSummary {
  partitions: PartitionInfo[]
  /** sum of (latest - earliest) across partitions; approximate message count */
  messageCount: string
}

export interface ConfigEntry {
  name: string
  value: string | null
  isDefault: boolean
  readOnly: boolean
}

export interface ConsumerGroupSummary {
  groupId: string
  state: string
  protocolType: string
  memberCount: number
}

export interface GroupMemberInfo {
  memberId: string
  clientId: string
  clientHost: string
  assignedPartitions: { topic: string; partitions: number[] }[]
}

export interface GroupOffsetRow {
  topic: string
  partition: number
  committedOffset: string
  /** partition log start/end offsets at fetch time */
  earliestOffset: string
  latestOffset: string
  /** latest - committed; '-' when nothing committed */
  lag: string
}

export interface ConsumerGroupDetail extends ConsumerGroupSummary {
  members: GroupMemberInfo[]
  offsets: GroupOffsetRow[]
}

/** ---- messages ---- */
export interface MessageHeader {
  key: string
  /** base64 of raw bytes */
  value: string
}

export interface KafkaMessage {
  topic: string
  partition: number
  offset: string
  timestamp: string
  /** base64 of raw bytes; null for null key/value (tombstones) */
  key: string | null
  value: string | null
  headers: MessageHeader[]
  keySize: number
  valueSize: number
}

export type FetchFrom = 'oldest' | 'newest' | 'offset' | 'timestamp'

export interface FetchMessagesRequest {
  profileId: string
  topic: string
  /** null = all partitions */
  partition: number | null
  from: FetchFrom
  /** used when from === 'offset' */
  startOffset?: string
  /** epoch ms, used when from === 'timestamp' */
  startTimestamp?: number
  maxMessages: number
}

export interface FetchMessagesResult {
  messages: KafkaMessage[]
  /** true if maxMessages was hit before reaching the log end */
  truncated: boolean
  durationMs: number
}

export interface ProduceRequest {
  profileId: string
  topic: string
  /** null lets the partitioner decide */
  partition: number | null
  /** utf-8 text; null produces a tombstone */
  key: string | null
  value: string | null
  headers: { key: string; value: string }[]
  /** produce the same message N times (test data generation) */
  repeat: number
}

export interface ProduceResult {
  count: number
  firstOffsets: { partition: number; baseOffset: string }[]
}

/** ---- offset management ---- */
export type ResetTarget = 'earliest' | 'latest' | 'offset' | 'timestamp'

export interface ResetOffsetsRequest {
  profileId: string
  groupId: string
  topic: string
  /** null = all partitions of the topic */
  partition: number | null
  target: ResetTarget
  /** used when target === 'offset' */
  offset?: string
  /** epoch ms, used when target === 'timestamp' */
  timestamp?: number
}

/** ---- topic admin ---- */
export interface CreateTopicRequest {
  profileId: string
  name: string
  numPartitions: number
  replicationFactor: number
  configs: { name: string; value: string }[]
}

/** ---- export / import ---- */
export interface ExportMessagesRequest {
  profileId: string
  topic: string
  format: 'json' | 'csv'
  /** messages already fetched in the renderer (indices into last fetch) — we re-serialize from raw */
  messages: KafkaMessage[]
}

export interface ExportResult {
  filePath: string | null
  count: number
}

export interface ImportMessagesRequest {
  profileId: string
  topic: string
}

export interface ImportResult {
  count: number
  cancelled: boolean
}

export interface AppSettings {
  theme: 'dark' | 'light'
  defaultMaxMessages: number
  /** false until the user dismisses the first-run welcome screen */
  onboarded: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultMaxMessages: 200,
  onboarded: false
}

export const DEMO_PROFILE_NAME = 'Demo Cluster (built-in)'

export type UpdateStatus =
  | { state: 'downloading'; version: string }
  | { state: 'progress'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }
