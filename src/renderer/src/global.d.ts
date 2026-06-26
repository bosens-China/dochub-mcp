import type { DocHubAPI } from '@shared/ipc/api-types'

export declare global {
  interface Window {
    api: DocHubAPI
  }
}

export {}
