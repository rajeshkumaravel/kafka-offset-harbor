import { contextBridge, ipcRenderer } from 'electron'
import type { InvokeFn, IpcResult } from '@shared/ipc'
import type { UpdateStatus } from '@shared/types'

/**
 * The renderer's entire surface: one typed invoke. Every call goes through
 * the IpcResult envelope so main-process errors arrive with clean messages.
 */
const invoke: InvokeFn = async (channel, ...args) => {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<never>
  if (!result.ok) throw new Error(result.error)
  return result.data
}

function onUpdateStatus(cb: (status: UpdateStatus) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, status: UpdateStatus) => cb(status)
  ipcRenderer.on('update-status', listener)
  return () => ipcRenderer.off('update-status', listener)
}

contextBridge.exposeInMainWorld('api', { invoke, onUpdateStatus })
