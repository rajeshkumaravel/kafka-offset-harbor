import type { InvokeFn } from '@shared/ipc'
import type { UpdateStatus } from '@shared/types'

declare global {
  interface Window {
    api: {
      invoke: InvokeFn
      onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void
    }
  }
}

export {}
