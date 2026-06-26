/** IPC invoke channel names — keep in sync with preload & main handlers */
export const IPC_CHANNELS = {
  sources: {
    list: 'sources:list',
    get: 'sources:get',
    add: 'sources:add',
    update: 'sources:update',
    delete: 'sources:delete',
    sync: 'sources:sync',
    detectSpa: 'sources:detectSpa'
  },
  docs: {
    tree: 'docs:tree',
    read: 'docs:read',
    search: 'docs:search'
  },
  sync: {
    progress: 'sync:progress',
    logs: 'sync:logs'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update'
  },
  mcp: {
    testConnection: 'mcp:testConnection'
  }
} as const

export type IpcChannel =
  | (typeof IPC_CHANNELS.sources)[keyof typeof IPC_CHANNELS.sources]
  | (typeof IPC_CHANNELS.docs)[keyof typeof IPC_CHANNELS.docs]
  | (typeof IPC_CHANNELS.sync)[keyof typeof IPC_CHANNELS.sync]
  | (typeof IPC_CHANNELS.settings)[keyof typeof IPC_CHANNELS.settings]
  | (typeof IPC_CHANNELS.mcp)[keyof typeof IPC_CHANNELS.mcp]
