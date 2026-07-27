import type {
  BrokerInfo,
  ConfigEntry,
  ConsumerGroupDetail,
  ConsumerGroupSummary,
  CreateTopicRequest,
  FetchMessagesRequest,
  FetchMessagesResult,
  ProduceRequest,
  ProduceResult,
  ResetOffsetsRequest,
  TopicDetail,
  TopicSummary
} from '@shared/types'

/** One connected cluster. Real clusters use kafkajs; the demo cluster is in-memory. */
export interface ClusterAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>

  brokers(): Promise<BrokerInfo[]>
  topics(): Promise<TopicSummary[]>
  topicDetail(topic: string): Promise<TopicDetail>
  topicConfigs(topic: string): Promise<ConfigEntry[]>
  groups(): Promise<ConsumerGroupSummary[]>
  groupDetail(groupId: string): Promise<ConsumerGroupDetail>

  fetchMessages(req: FetchMessagesRequest): Promise<FetchMessagesResult>
  produce(req: ProduceRequest): Promise<ProduceResult>

  resetOffsets(req: ResetOffsetsRequest): Promise<void>
  deleteGroup(groupId: string): Promise<void>

  createTopic(req: CreateTopicRequest): Promise<void>
  deleteTopic(topic: string): Promise<void>
  addPartitions(topic: string, totalCount: number): Promise<void>
  setTopicConfig(topic: string, name: string, value: string): Promise<void>
}
