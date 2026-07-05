import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_EVENTS } from '@shared/ipc/events'
import type { DocHubAPI } from '@shared/ipc/api-types'
import type { AddSourceInput, AppSettings, CrawlMode, UpdateSourceInput } from '@shared/types'

export function createDocHubAPI(): DocHubAPI {
  return {
    listSources: () => ipcRenderer.invoke(IPC_CHANNELS.sources.list),
    getSource: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.sources.get, id),
    addSource: (input: AddSourceInput) => ipcRenderer.invoke(IPC_CHANNELS.sources.add, input),
    updateSource: (input: UpdateSourceInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.sources.update, input),
    detectSpa: (seedUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.sources.detectSpa, seedUrl),
    previewCrawl: (url: string, mode: CrawlMode) =>
      ipcRenderer.invoke(IPC_CHANNELS.sources.previewCrawl, url, mode),
    deleteSource: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.sources.delete, id),
    triggerSync: (sourceId: string) => ipcRenderer.invoke(IPC_CHANNELS.sources.sync, sourceId),
    pauseSync: (sourceId: string) => ipcRenderer.invoke(IPC_CHANNELS.sources.pauseSync, sourceId),
    getDocTree: (sourceId: string) => ipcRenderer.invoke(IPC_CHANNELS.docs.tree, sourceId),
    readDocument: (sourceId: string, path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.docs.read, sourceId, path),
    openFolder: (sourceId: string, path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.docs.openFolder, sourceId, path),
    getSyncProgress: () => ipcRenderer.invoke(IPC_CHANNELS.sync.progress),
    getSyncLogs: () => ipcRenderer.invoke(IPC_CHANNELS.sync.logs),
    getAppLogs: () => ipcRenderer.invoke(IPC_CHANNELS.logs.app),
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
    updateSettings: (partial: Partial<AppSettings>) =>
      ipcRenderer.invoke(IPC_CHANNELS.settings.update, partial),
    searchDocuments: (query: string, sourceId: string | null) =>
      ipcRenderer.invoke(IPC_CHANNELS.docs.search, query, sourceId),
    testMcpConnection: (host: string, port: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.mcp.testConnection, host, port),
    getMcpStatus: () => ipcRenderer.invoke(IPC_CHANNELS.mcp.getStatus),
    onDeveloperPanelToggle: (listener: () => void) => {
      const channel = IPC_EVENTS.dev.togglePanel
      const handler = (): void => {
        listener()
      }
      ipcRenderer.on(channel, handler)
      return () => {
        ipcRenderer.removeListener(channel, handler)
      }
    }
  }
}
