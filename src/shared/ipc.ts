import type {
  AppSettings,
  BrokerInfo,
  ClusterProfile,
  ClusterProfileInput,
  ConfigEntry,
  ConsumerGroupDetail,
  ConsumerGroupSummary,
  CreateTopicRequest,
  ExportMessagesRequest,
  ExportResult,
  FetchMessagesRequest,
  FetchMessagesResult,
  ImportMessagesRequest,
  ImportResult,
  ProduceRequest,
  ProduceResult,
  ResetOffsetsRequest,
  TestConnectionResult,
  TopicDetail,
  TopicSummary
} from './types'

/**
 * The full IPC surface. Preload exposes `window.api.invoke(channel, ...args)`
 * typed against this map; main registers one ipcMain.handle per key.
 */
export interface IpcApi {
  'profiles:list': () => ClusterProfile[]
  'profiles:create': (input: ClusterProfileInput) => ClusterProfile
  'profiles:update': (id: string, input: ClusterProfileInput) => ClusterProfile
  'profiles:delete': (id: string) => void
  'profiles:test': (input: ClusterProfileInput, existingId: string | null) => TestConnectionResult

  'cluster:connect': (profileId: string) => void
  'cluster:disconnect': (profileId: string) => void
  'cluster:brokers': (profileId: string) => BrokerInfo[]
  'cluster:topics': (profileId: string) => TopicSummary[]
  'cluster:topicDetail': (profileId: string, topic: string) => TopicDetail
  'cluster:topicConfigs': (profileId: string, topic: string) => ConfigEntry[]
  'cluster:groups': (profileId: string) => ConsumerGroupSummary[]
  'cluster:groupDetail': (profileId: string, groupId: string) => ConsumerGroupDetail

  'messages:fetch': (req: FetchMessagesRequest) => FetchMessagesResult
  'messages:produce': (req: ProduceRequest) => ProduceResult
  'messages:saveToFile': (suggestedName: string, contentBase64: string) => string | null
  'messages:export': (req: ExportMessagesRequest) => ExportResult
  'messages:import': (req: ImportMessagesRequest) => ImportResult

  'offsets:reset': (req: ResetOffsetsRequest) => void
  'groups:delete': (profileId: string, groupId: string) => void

  'topics:create': (req: CreateTopicRequest) => void
  'topics:delete': (profileId: string, topic: string) => void
  'topics:addPartitions': (profileId: string, topic: string, totalCount: number) => void
  'topics:setConfig': (profileId: string, topic: string, name: string, value: string) => void

  'app:getSettings': () => AppSettings
  'app:setSettings': (settings: Partial<AppSettings>) => AppSettings
  /** Flush all connections, credentials and settings; returns fresh defaults */
  'app:reset': () => AppSettings
}

export type IpcChannel = keyof IpcApi

export type InvokeFn = <K extends IpcChannel>(
  channel: K,
  ...args: Parameters<IpcApi[K]>
) => Promise<Awaited<ReturnType<IpcApi[K]>>>

/** Envelope used across the wire so errors survive IPC with clean messages */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }
