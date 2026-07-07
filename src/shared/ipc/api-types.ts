import type {
  AddSourceInput,
  UpdateSourceInput,
  SpaDetectionResult,
  SourceDetail,
  AppSettings,
  AppLogEntry,
  DocContent,
  DocSource,
  DocTreeNode,
  McpStatus,
  OllamaStatus,
  SearchResult,
  SearchMode,
  CrawlMode,
  SyncLogEntry,
  SyncProgress
} from '@shared/types'

/** Typed surface exposed to renderer via contextBridge */
export interface DocHubAPI {
  listSources(): Promise<DocSource[]>
  getSource(id: string): Promise<SourceDetail>
  addSource(input: AddSourceInput): Promise<DocSource>
  updateSource(input: UpdateSourceInput): Promise<DocSource>
  detectSpa(seedUrl: string): Promise<SpaDetectionResult>
  deleteSource(id: string): Promise<void>
  triggerSync(sourceId: string): Promise<void>
  pauseSync(sourceId: string): Promise<void>
  previewCrawl(url: string, mode: CrawlMode): Promise<string>
  getDocTree(sourceId: string): Promise<DocTreeNode[]>
  readDocument(sourceId: string, path: string): Promise<DocContent>
  openFolder(sourceId: string, path: string): Promise<void>
  getSyncProgress(): Promise<SyncProgress[]>
  getSyncLogs(): Promise<SyncLogEntry[]>
  getAppLogs(): Promise<AppLogEntry[]>
  getSettings(): Promise<AppSettings>
  updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>
  searchDocuments(
    query: string,
    sourceId: string | null,
    mode?: SearchMode,
    limit?: number,
    rerank?: boolean,
    minScore?: number
  ): Promise<SearchResult[]>
  testMcpConnection(host: string, port: number): Promise<boolean>
  getMcpStatus(): Promise<McpStatus>
  getOllamaStatus(): Promise<OllamaStatus>
  /** Dev build only — subscribe to ⌘⇧D / Ctrl+Shift+D panel toggle */
  onDeveloperPanelToggle(listener: () => void): () => void
}
