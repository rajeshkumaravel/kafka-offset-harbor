import { create } from 'zustand'
import type {
  AppSettings,
  BrokerInfo,
  ClusterProfile,
  ConfigEntry,
  ConsumerGroupDetail,
  ConsumerGroupSummary,
  FetchFrom,
  FetchMessagesResult,
  KafkaMessage,
  ProduceRequest,
  ResetOffsetsRequest,
  TopicDetail,
  TopicSummary
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { b64ToUtf8, jsonPathLookup } from '../lib/bytes'

const api = window.api

export type Selection =
  | { kind: 'none' }
  | { kind: 'brokers' }
  | { kind: 'topic'; topic: string }
  | { kind: 'group'; groupId: string }

export type ConnState = 'idle' | 'connecting' | 'connected' | 'error'

export type FilterMode = 'contains' | 'regex' | 'jsonpath'

export interface FetchParams {
  partition: number | null
  from: FetchFrom
  startOffset: string
  /** datetime-local string */
  startTime: string
  maxMessages: number
}

export interface ConfirmRequest {
  title: string
  body: string
  confirmLabel: string
  danger: boolean
  action: () => Promise<void>
}

interface AppState {
  ready: boolean
  settings: AppSettings

  profiles: ClusterProfile[]
  activeProfileId: string | null
  connState: ConnState
  connError: string | null

  brokers: BrokerInfo[]
  topics: TopicSummary[]
  groups: ConsumerGroupSummary[]
  treeSearch: string

  selection: Selection
  topicDetail: TopicDetail | null
  topicConfigs: ConfigEntry[] | null
  groupDetail: ConsumerGroupDetail | null
  detailLoading: boolean
  detailError: string | null

  fetchParams: FetchParams
  fetching: boolean
  fetchResult: FetchMessagesResult | null
  fetchError: string | null
  filterText: string
  filterMode: FilterMode
  selectedMessage: KafkaMessage | null

  showConnections: boolean
  showHelp: boolean
  showProduce: boolean
  showCreateTopic: boolean
  resetRequest: { groupId: string; topic: string; partition: number | null } | null
  confirmRequest: ConfirmRequest | null
  detailsCollapsed: boolean
  welcome: boolean
  resetting: boolean
  toast: { kind: 'info' | 'error'; text: string } | null

  init(): Promise<void>
  setTheme(theme: 'dark' | 'light'): void
  showToast(kind: 'info' | 'error', text: string): void
  refreshProfiles(): Promise<void>
  selectProfile(id: string): Promise<void>
  refreshTree(): Promise<void>
  select(sel: Selection): Promise<void>
  refreshSelection(): Promise<void>

  setFetchParams(patch: Partial<FetchParams>): void
  fetchMessages(): Promise<void>
  setFilter(text: string, mode?: FilterMode): void
  filteredMessages(): KafkaMessage[]
  selectMessage(m: KafkaMessage | null): void

  produce(req: Omit<ProduceRequest, 'profileId'>): Promise<void>
  resetOffsets(req: Omit<ResetOffsetsRequest, 'profileId'>): Promise<void>
  deleteGroup(groupId: string): void
  createTopic(name: string, partitions: number, replication: number): Promise<void>
  deleteTopic(topic: string): void
  addPartitions(topic: string, totalCount: number): Promise<void>
  setTopicConfig(name: string, value: string): Promise<void>
  exportMessages(format: 'json' | 'csv'): Promise<void>
  importMessages(): Promise<void>
  saveMessagePart(part: 'key' | 'value'): Promise<void>

  setShowConnections(v: boolean): void
  setShowHelp(v: boolean): void
  setShowProduce(v: boolean): void
  setShowCreateTopic(v: boolean): void
  setResetRequest(req: AppState['resetRequest']): void
  setConfirmRequest(req: ConfirmRequest | null): void
  setDetailsCollapsed(v: boolean): void
  setTreeSearch(term: string): void
  resetApp(): Promise<void>
  finishWelcome(action: 'demo' | 'connect'): void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,

  profiles: [],
  activeProfileId: null,
  connState: 'idle',
  connError: null,

  brokers: [],
  topics: [],
  groups: [],
  treeSearch: '',

  selection: { kind: 'none' },
  topicDetail: null,
  topicConfigs: null,
  groupDetail: null,
  detailLoading: false,
  detailError: null,

  fetchParams: {
    partition: null,
    from: 'newest',
    startOffset: '0',
    startTime: '',
    maxMessages: DEFAULT_SETTINGS.defaultMaxMessages
  },
  fetching: false,
  fetchResult: null,
  fetchError: null,
  filterText: '',
  filterMode: 'contains',
  selectedMessage: null,

  showConnections: false,
  showHelp: false,
  showProduce: false,
  showCreateTopic: false,
  resetRequest: null,
  confirmRequest: null,
  detailsCollapsed: false,
  welcome: false,
  resetting: false,
  toast: null,

  async init() {
    const settings = await api.invoke('app:getSettings')
    document.documentElement.dataset.theme = settings.theme
    const profiles = await api.invoke('profiles:list')
    set({
      settings,
      profiles,
      ready: true,
      fetchParams: { ...get().fetchParams, maxMessages: settings.defaultMaxMessages }
    })
    set({ welcome: !settings.onboarded })
    const demo = profiles.find((p) => p.isDemo)
    if (demo) await get().selectProfile(demo.id)
  },

  setTheme(theme) {
    document.documentElement.dataset.theme = theme
    set((s) => ({ settings: { ...s.settings, theme } }))
    void api.invoke('app:setSettings', { theme })
  },

  showToast(kind, text) {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: { kind, text } })
    toastTimer = setTimeout(() => set({ toast: null }), kind === 'error' ? 5000 : 2600)
  },

  async refreshProfiles() {
    set({ profiles: await api.invoke('profiles:list') })
  },

  async selectProfile(id) {
    set({
      activeProfileId: id,
      connState: 'connecting',
      connError: null,
      selection: { kind: 'none' },
      brokers: [],
      topics: [],
      groups: [],
      topicDetail: null,
      topicConfigs: null,
      groupDetail: null,
      fetchResult: null,
      fetchError: null,
      selectedMessage: null
    })
    try {
      await api.invoke('cluster:connect', id)
      set({ connState: 'connected' })
      await get().refreshTree()
    } catch (err) {
      set({ connState: 'error', connError: err instanceof Error ? err.message : String(err) })
    }
  },

  async refreshTree() {
    const id = get().activeProfileId
    if (!id || get().connState !== 'connected') return
    try {
      const [brokers, topics, groups] = await Promise.all([
        api.invoke('cluster:brokers', id),
        api.invoke('cluster:topics', id),
        api.invoke('cluster:groups', id)
      ])
      set({ brokers, topics, groups })
    } catch (err) {
      get().showToast('error', err instanceof Error ? err.message : String(err))
    }
  },

  async select(sel) {
    set({
      selection: sel,
      topicDetail: null,
      topicConfigs: null,
      groupDetail: null,
      detailError: null,
      fetchResult: null,
      fetchError: null,
      selectedMessage: null,
      filterText: ''
    })
    await get().refreshSelection()
  },

  async refreshSelection() {
    const { selection, activeProfileId } = get()
    if (!activeProfileId) return
    if (selection.kind === 'topic') {
      set({ detailLoading: true, detailError: null })
      try {
        const [detail, configs] = await Promise.all([
          api.invoke('cluster:topicDetail', activeProfileId, selection.topic),
          api.invoke('cluster:topicConfigs', activeProfileId, selection.topic)
        ])
        set({ topicDetail: detail, topicConfigs: configs, detailLoading: false })
      } catch (err) {
        set({
          detailLoading: false,
          detailError: err instanceof Error ? err.message : String(err)
        })
      }
    } else if (selection.kind === 'group') {
      set({ detailLoading: true, detailError: null })
      try {
        const detail = await api.invoke('cluster:groupDetail', activeProfileId, selection.groupId)
        set({ groupDetail: detail, detailLoading: false })
      } catch (err) {
        set({
          detailLoading: false,
          detailError: err instanceof Error ? err.message : String(err)
        })
      }
    }
  },

  setFetchParams(patch) {
    set((s) => ({ fetchParams: { ...s.fetchParams, ...patch } }))
  },

  async fetchMessages() {
    const { selection, activeProfileId, fetchParams } = get()
    if (selection.kind !== 'topic' || !activeProfileId) return
    set({ fetching: true, fetchError: null, selectedMessage: null })
    try {
      const result = await api.invoke('messages:fetch', {
        profileId: activeProfileId,
        topic: selection.topic,
        partition: fetchParams.partition,
        from: fetchParams.from,
        startOffset: fetchParams.startOffset,
        startTimestamp: fetchParams.startTime ? new Date(fetchParams.startTime).getTime() : undefined,
        maxMessages: fetchParams.maxMessages
      })
      set({ fetchResult: result, fetching: false })
    } catch (err) {
      set({ fetching: false, fetchError: err instanceof Error ? err.message : String(err) })
    }
  },

  setFilter(text, mode) {
    set((s) => ({ filterText: text, filterMode: mode ?? s.filterMode }))
  },

  filteredMessages() {
    const { fetchResult, filterText, filterMode } = get()
    const messages = fetchResult?.messages ?? []
    const needle = filterText.trim()
    if (!needle) return messages
    if (filterMode === 'jsonpath') {
      // "$.path" or "$.path=value"
      const eq = needle.indexOf('=')
      const path = eq === -1 ? needle : needle.slice(0, eq).trim()
      const expected = eq === -1 ? null : needle.slice(eq + 1).trim()
      return messages.filter((m) => {
        if (m.value === null) return false
        const found = jsonPathLookup(b64ToUtf8(m.value), path)
        if (found === undefined) return false
        return expected === null || found === expected
      })
    }
    let regex: RegExp | null = null
    if (filterMode === 'regex') {
      try {
        regex = new RegExp(needle, 'i')
      } catch {
        return messages
      }
    }
    const matches = (raw: string | null): boolean => {
      if (raw === null) return false
      const text = b64ToUtf8(raw)
      return regex ? regex.test(text) : text.toLowerCase().includes(needle.toLowerCase())
    }
    return messages.filter(
      (m) =>
        matches(m.key) ||
        matches(m.value) ||
        m.headers.some((h) => h.key.toLowerCase().includes(needle.toLowerCase()) || matches(h.value))
    )
  },

  selectMessage(m) {
    set({ selectedMessage: m, detailsCollapsed: false })
  },

  async produce(req) {
    const id = get().activeProfileId
    if (!id) return
    const result = await api.invoke('messages:produce', { ...req, profileId: id })
    get().showToast('info', `produced ${result.count} message${result.count === 1 ? '' : 's'} to ${req.topic}`)
    await get().refreshSelection()
  },

  async resetOffsets(req) {
    const id = get().activeProfileId
    if (!id) return
    await api.invoke('offsets:reset', { ...req, profileId: id })
    get().showToast('info', `offsets reset for ${req.groupId}`)
    await get().refreshSelection()
  },

  deleteGroup(groupId) {
    const { activeProfileId, showToast } = get()
    if (!activeProfileId) return
    get().setConfirmRequest({
      title: 'Delete consumer group',
      body: `This permanently deletes the consumer group "${groupId}" and all its committed offsets. Consumers using this group will start over according to their auto.offset.reset policy.`,
      confirmLabel: 'Delete group',
      danger: true,
      action: async () => {
        await api.invoke('groups:delete', activeProfileId, groupId)
        showToast('info', `deleted group ${groupId}`)
        set({ selection: { kind: 'none' }, groupDetail: null })
        await get().refreshTree()
      }
    })
  },

  async createTopic(name, partitions, replication) {
    const id = get().activeProfileId
    if (!id) return
    await api.invoke('topics:create', {
      profileId: id,
      name,
      numPartitions: partitions,
      replicationFactor: replication,
      configs: []
    })
    get().showToast('info', `created topic ${name}`)
    await get().refreshTree()
    await get().select({ kind: 'topic', topic: name })
  },

  deleteTopic(topic) {
    const { activeProfileId, showToast } = get()
    if (!activeProfileId) return
    get().setConfirmRequest({
      title: 'Delete topic',
      body: `This permanently deletes the topic "${topic}" and ALL of its messages on the cluster. This cannot be undone.`,
      confirmLabel: 'Delete topic',
      danger: true,
      action: async () => {
        await api.invoke('topics:delete', activeProfileId, topic)
        showToast('info', `deleted topic ${topic}`)
        set({ selection: { kind: 'none' }, topicDetail: null, fetchResult: null })
        await get().refreshTree()
      }
    })
  },

  async addPartitions(topic, totalCount) {
    const id = get().activeProfileId
    if (!id) return
    await api.invoke('topics:addPartitions', id, topic, totalCount)
    get().showToast('info', `${topic} now has ${totalCount} partitions`)
    await get().refreshSelection()
    await get().refreshTree()
  },

  async setTopicConfig(name, value) {
    const { activeProfileId, selection } = get()
    if (!activeProfileId || selection.kind !== 'topic') return
    await api.invoke('topics:setConfig', activeProfileId, selection.topic, name, value)
    get().showToast('info', `set ${name}=${value}`)
    await get().refreshSelection()
  },

  async exportMessages(format) {
    const { activeProfileId, selection } = get()
    const messages = get().filteredMessages()
    if (!activeProfileId || selection.kind !== 'topic' || messages.length === 0) return
    const result = await api.invoke('messages:export', {
      profileId: activeProfileId,
      topic: selection.topic,
      format,
      messages
    })
    if (result.filePath) get().showToast('info', `exported ${result.count} messages to ${result.filePath}`)
  },

  async importMessages() {
    const { activeProfileId, selection } = get()
    if (!activeProfileId || selection.kind !== 'topic') return
    try {
      const result = await api.invoke('messages:import', {
        profileId: activeProfileId,
        topic: selection.topic
      })
      if (!result.cancelled) {
        get().showToast('info', `imported ${result.count} messages into ${selection.topic}`)
        await get().refreshSelection()
      }
    } catch (err) {
      get().showToast('error', err instanceof Error ? err.message : String(err))
    }
  },

  async saveMessagePart(part) {
    const m = get().selectedMessage
    if (!m) return
    const content = part === 'key' ? m.key : m.value
    if (content === null) {
      get().showToast('error', `message ${part} is null`)
      return
    }
    const name = `${m.topic}-p${m.partition}-o${m.offset}.${part === 'key' ? 'key' : 'payload'}.txt`
    const saved = await api.invoke('messages:saveToFile', name, content)
    if (saved) get().showToast('info', `saved to ${saved}`)
  },

  setShowConnections(v) {
    set({ showConnections: v })
  },
  setShowHelp(v) {
    set({ showHelp: v })
  },
  setShowProduce(v) {
    set({ showProduce: v })
  },
  setShowCreateTopic(v) {
    set({ showCreateTopic: v })
  },
  setResetRequest(req) {
    set({ resetRequest: req })
  },
  setConfirmRequest(req) {
    set({ confirmRequest: req })
  },
  setDetailsCollapsed(v) {
    set({ detailsCollapsed: v })
  },
  setTreeSearch(term) {
    set({ treeSearch: term })
  },

  async resetApp() {
    set({ resetting: true })
    try {
      const settings = await api.invoke('app:reset')
      document.documentElement.dataset.theme = settings.theme
      const profiles = await api.invoke('profiles:list')
      set({
        settings,
        profiles,
        resetting: false,
        welcome: true,
        showHelp: false,
        showConnections: false,
        activeProfileId: null,
        connState: 'idle',
        connError: null,
        selection: { kind: 'none' },
        brokers: [],
        topics: [],
        groups: [],
        topicDetail: null,
        topicConfigs: null,
        groupDetail: null,
        fetchResult: null,
        fetchError: null,
        selectedMessage: null,
        treeSearch: ''
      })
      get().showToast('info', 'all data cleared — the app has been reset')
    } catch (err) {
      set({ resetting: false })
      get().showToast('error', err instanceof Error ? err.message : String(err))
    }
  },

  finishWelcome(action) {
    set({ welcome: false })
    void api.invoke('app:setSettings', { onboarded: true })
    set((s) => ({ settings: { ...s.settings, onboarded: true } }))
    if (action === 'connect') {
      set({ showConnections: true })
    } else {
      const demo = get().profiles.find((p) => p.isDemo)
      if (demo) void get().selectProfile(demo.id)
    }
  }
}))
