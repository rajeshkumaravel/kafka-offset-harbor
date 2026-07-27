import { BrowserWindow, ipcMain } from 'electron'
import type { IpcApi, IpcChannel, IpcResult } from '@shared/ipc'
import { exportMessages, importMessages, saveToFile } from './fileTransfer'
import { disconnect, disconnectAll, getAdapter, testConnection } from './kafka/manager'
import {
  createProfile,
  deleteProfile,
  getAppSettings,
  listProfiles,
  resetStore,
  setAppSettings,
  updateProfile
} from './store/sqlite'

type Handler<K extends IpcChannel> = (
  ...args: Parameters<IpcApi[K]>
) => ReturnType<IpcApi[K]> | Promise<ReturnType<IpcApi[K]>>

/** Wraps handlers in a result envelope so error messages survive IPC cleanly */
function handle<K extends IpcChannel>(channel: K, fn: Handler<K>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<unknown>> => {
    try {
      return { ok: true, data: await fn(...(args as Parameters<IpcApi[K]>)) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  // --- cluster profiles ---
  handle('profiles:list', () => listProfiles())
  handle('profiles:create', (input) => createProfile(input))
  handle('profiles:update', (id, input) => updateProfile(id, input))
  handle('profiles:delete', async (id) => {
    await disconnect(id)
    deleteProfile(id)
  })
  handle('profiles:test', (input, existingId) => testConnection(input, existingId))

  // --- cluster metadata ---
  handle('cluster:connect', async (profileId) => {
    await getAdapter(profileId)
  })
  handle('cluster:disconnect', (profileId) => disconnect(profileId))
  handle('cluster:brokers', async (profileId) => (await getAdapter(profileId)).brokers())
  handle('cluster:topics', async (profileId) => (await getAdapter(profileId)).topics())
  handle('cluster:topicDetail', async (profileId, topic) =>
    (await getAdapter(profileId)).topicDetail(topic)
  )
  handle('cluster:topicConfigs', async (profileId, topic) =>
    (await getAdapter(profileId)).topicConfigs(topic)
  )
  handle('cluster:groups', async (profileId) => (await getAdapter(profileId)).groups())
  handle('cluster:groupDetail', async (profileId, groupId) =>
    (await getAdapter(profileId)).groupDetail(groupId)
  )

  // --- messages ---
  handle('messages:fetch', async (req) => (await getAdapter(req.profileId)).fetchMessages(req))
  handle('messages:produce', async (req) => (await getAdapter(req.profileId)).produce(req))
  handle('messages:saveToFile', (suggestedName, contentBase64) =>
    saveToFile(getWindow(), suggestedName, contentBase64)
  )
  handle('messages:export', (req) => exportMessages(getWindow(), req))
  handle('messages:import', (req) => importMessages(getWindow(), req))

  // --- offsets / groups ---
  handle('offsets:reset', async (req) => (await getAdapter(req.profileId)).resetOffsets(req))
  handle('groups:delete', async (profileId, groupId) =>
    (await getAdapter(profileId)).deleteGroup(groupId)
  )

  // --- topic admin ---
  handle('topics:create', async (req) => (await getAdapter(req.profileId)).createTopic(req))
  handle('topics:delete', async (profileId, topic) => (await getAdapter(profileId)).deleteTopic(topic))
  handle('topics:addPartitions', async (profileId, topic, totalCount) =>
    (await getAdapter(profileId)).addPartitions(topic, totalCount)
  )
  handle('topics:setConfig', async (profileId, topic, name, value) =>
    (await getAdapter(profileId)).setTopicConfig(topic, name, value)
  )

  // --- settings ---
  handle('app:getSettings', () => getAppSettings())
  handle('app:setSettings', (settings) => setAppSettings(settings))
  handle('app:reset', async () => {
    await disconnectAll()
    resetStore()
    return getAppSettings()
  })
}
