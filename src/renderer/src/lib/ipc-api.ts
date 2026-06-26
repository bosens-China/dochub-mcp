import type { DocHubAPI } from '@shared/ipc/api-types'
import type {
  AddSourceInput,
  AppSettings,
  DocSource,
  DocTreeNode,
  SearchResult,
  SourceDetail,
  SpaDetectionResult,
  SyncLogEntry,
  SyncProgress,
  UpdateSourceInput
} from '@shared/types'

function getApi(): DocHubAPI {
  if (!window.api) {
    throw new Error('DocHub API 仅在 Electron 环境中可用')
  }
  return window.api
}

export function fetchSources(): Promise<DocSource[]> {
  return getApi().listSources()
}

export function fetchSource(id: string): Promise<SourceDetail> {
  return getApi().getSource(id)
}

export function addSource(input: AddSourceInput): Promise<DocSource> {
  return getApi().addSource(input)
}

export function updateSource(input: UpdateSourceInput): Promise<DocSource> {
  return getApi().updateSource(input)
}

export function detectSpa(seedUrl: string): Promise<SpaDetectionResult> {
  return getApi().detectSpa(seedUrl)
}

export function deleteSource(id: string): Promise<void> {
  return getApi().deleteSource(id)
}

export function triggerSync(sourceId: string): Promise<void> {
  return getApi().triggerSync(sourceId)
}

export function fetchDocTree(sourceId: string): Promise<DocTreeNode[]> {
  return getApi().getDocTree(sourceId)
}

export function fetchDocContent(sourceId: string, path: string): Promise<string> {
  return getApi().readDocument(sourceId, path)
}

export function fetchSyncProgress(): Promise<SyncProgress[]> {
  return getApi().getSyncProgress()
}

export function fetchSyncLogs(): Promise<SyncLogEntry[]> {
  return getApi().getSyncLogs()
}

export function fetchSettings(): Promise<AppSettings> {
  return getApi().getSettings()
}

export function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  return getApi().updateSettings(partial)
}

export function testMcpConnection(host: string, port: number): Promise<boolean> {
  return getApi().testMcpConnection(host, port)
}

export function searchDocuments(query: string, sourceId: string | null): Promise<SearchResult[]> {
  return getApi().searchDocuments(query, sourceId)
}
