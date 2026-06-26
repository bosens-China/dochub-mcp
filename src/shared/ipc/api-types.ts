import type {
  AddSourceInput,
  UpdateSourceInput,
  SpaDetectionResult,
  SourceDetail,
  AppSettings,
  DocContent,
  DocSource,
  DocTreeNode,
  SearchResult,
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
  getDocTree(sourceId: string): Promise<DocTreeNode[]>
  readDocument(sourceId: string, path: string): Promise<DocContent>
  getSyncProgress(): Promise<SyncProgress[]>
  getSyncLogs(): Promise<SyncLogEntry[]>
  getSettings(): Promise<AppSettings>
  updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>
  searchDocuments(query: string, sourceId: string | null): Promise<SearchResult[]>
  testMcpConnection(host: string, port: number): Promise<boolean>
  /** Dev build only — subscribe to ⌘⇧D / Ctrl+Shift+D panel toggle */
  onDeveloperPanelToggle(listener: () => void): () => void
}
