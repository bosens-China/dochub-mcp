/** IPC invoke channel names — keep in sync with preload & main handlers */
export const IPC_CHANNELS = {
  sources: {
    list: 'sources:list',
    get: 'sources:get',
    add: 'sources:add',
    update: 'sources:update',
    delete: 'sources:delete',
    sync: 'sources:sync',
    pauseSync: 'sources:pauseSync',
    detectSpa: 'sources:detectSpa',
    previewCrawl: 'sources:previewCrawl'
  },
  docs: {
    tree: 'docs:tree',
    read: 'docs:read',
    search: 'docs:search',
    openFolder: 'docs:openFolder'
  },
  sync: {
    progress: 'sync:progress',
    logs: 'sync:logs'
  },
  logs: {
    app: 'logs:app'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update'
  },
  mcp: {
    testConnection: 'mcp:testConnection',
    getStatus: 'mcp:getStatus'
  },
  ollama: {
    getStatus: 'ollama:getStatus'
  }
} as const

export type IpcChannel =
  | (typeof IPC_CHANNELS.sources)[keyof typeof IPC_CHANNELS.sources]
  | (typeof IPC_CHANNELS.docs)[keyof typeof IPC_CHANNELS.docs]
  | (typeof IPC_CHANNELS.sync)[keyof typeof IPC_CHANNELS.sync]
  | (typeof IPC_CHANNELS.logs)[keyof typeof IPC_CHANNELS.logs]
  | (typeof IPC_CHANNELS.settings)[keyof typeof IPC_CHANNELS.settings]
  | (typeof IPC_CHANNELS.mcp)[keyof typeof IPC_CHANNELS.mcp]
  | (typeof IPC_CHANNELS.ollama)[keyof typeof IPC_CHANNELS.ollama]
