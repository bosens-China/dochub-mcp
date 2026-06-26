import type { DocHubAPI } from '@shared/ipc/api-types'

export type { DocHubAPI }

export interface DocHubPreloadBridge {
  api: DocHubAPI
}
