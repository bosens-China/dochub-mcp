import type { AppConfig } from '@shared/types/config'
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
import { loadConfig, saveConfig, ensureDataDirs } from '../../config'
import { toDocSource, toSourceDetail } from '../source/util'
import {
  createAndWriteSourceRecord,
  deleteSourceRecord,
  listSourceRecords,
  readSourceRecord,
  updateSourceRecord
} from '../source/store'
import {
  getAllActiveSyncProgress,
  getSyncProgress,
  listDocTree,
  readDocFile,
  runSourceSync
} from '../sync/runner'
import { readSyncLogs } from '../sync/persistence'
import { detectSpa as runSpaDetect } from '../discovery/spa-detect'
import { searchKeyword } from '../indexer/fts'
import { mcpHealthUrl } from '@shared/constants/mcp'

function buildTree(nodes: Array<{ key: string; title: string; isLeaf?: boolean }>): DocTreeNode[] {
  const root: DocTreeNode[] = []
  const map = new Map<string, DocTreeNode>()

  for (const node of nodes) {
    const parts = node.key.split('/')
    let current = root
    let path = ''
    for (let i = 0; i < parts.length; i++) {
      path = path ? `${path}/${parts[i]}` : parts[i]!
      let existing = map.get(path)
      if (!existing) {
        existing = {
          key: path,
          title: parts[i]!,
          isLeaf: i === parts.length - 1 ? node.isLeaf : false,
          children: []
        }
        map.set(path, existing)
        current.push(existing)
      }
      current = existing.children ?? []
    }
  }
  return root
}

function toUiSettings(config: AppConfig): AppSettings {
  return {
    dataDir: config.dataDir,
    mcp: config.mcp,
    crawl: {
      respectRobots: config.crawl.respectRobots,
      concurrency: config.crawl.concurrency,
      rateLimitMode: config.crawl.rateLimit.mode,
      rateLimitFixedMs: config.crawl.rateLimit.fixedMs,
      rateLimitRandomMinMs: config.crawl.rateLimit.randomMinMs,
      rateLimitRandomMaxMs: config.crawl.rateLimit.randomMaxMs,
      requestTimeoutMs: config.crawl.requestTimeoutMs,
      userAgent: config.crawl.userAgent,
      defaultHeaders: config.crawl.defaultHeaders
    },
    ui: config.ui
  }
}

function toSyncLogEntries(
  lines: Awaited<ReturnType<typeof readSyncLogs>>,
  nameMap: Map<string, string>
): SyncLogEntry[] {
  return lines.map((line, i) => ({
    id: `${line.ts}-${i}`,
    sourceId: line.sourceId,
    sourceName: nameMap.get(line.sourceId) ?? line.sourceId,
    action: line.action,
    level: line.action === 'fail' || line.action === 'domain_halt' ? 'error' : line.action === 'delete' ? 'warn' : 'info',
    message:
      line.message ??
      (line.reason === 'content_unchanged'
        ? '跳过：内容未变化'
        : line.reason === 'removed_from_site'
          ? '删除：远端已移除'
          : line.reason === 'domain_failure_threshold'
            ? '域名熔断：失败 URL 达到阈值'
            : line.reason ?? line.action),
    timestamp: line.ts,
    url: line.url,
    path: line.path,
    reason: line.reason
  }))
}

export class SourceManager {
  private config: AppConfig | null = null

  async init(): Promise<void> {
    this.config = await loadConfig()
    await ensureDataDirs(this.config)
  }

  private cfg(): AppConfig {
    if (!this.config) throw new Error('SourceManager 未初始化')
    return this.config
  }

  async listSources(): Promise<DocSource[]> {
    const records = await listSourceRecords(this.cfg())
    return records.map(toDocSource)
  }

  async getSource(id: string): Promise<SourceDetail> {
    const record = await readSourceRecord(id, this.cfg())
    if (!record) throw new Error(`文档源不存在: ${id}`)
    return toSourceDetail(record)
  }

  async addSource(input: AddSourceInput): Promise<DocSource> {
    const record = await createAndWriteSourceRecord(input, this.cfg())
    const source = toDocSource(record)
    this.triggerSync(record.id)
    return source
  }

  async updateSource(input: UpdateSourceInput): Promise<DocSource> {
    const record = await updateSourceRecord(input, this.cfg())
    return toDocSource(record)
  }

  async detectSpa(seedUrl: string): Promise<SpaDetectionResult> {
    const config = this.cfg()
    const result = await runSpaDetect(seedUrl, config.crawl, config.crawl.defaultHeaders)
    return {
      confidence: result.confidence,
      score: result.score,
      recommendedMode: result.recommendedMode,
      previewCharCount: result.previewCharCount,
      previewMarkdown: result.previewMarkdown,
      signals: result.signals.map((s) => ({
        id: s.id,
        hit: s.hit,
        label: s.label,
        weight: s.weight
      }))
    }
  }

  async deleteSource(id: string): Promise<void> {
    await deleteSourceRecord(id, this.cfg())
  }

  triggerSync(sourceId: string): void {
    const config = this.cfg()
    void runSourceSync(sourceId, config).catch((err) => {
      console.error('[sync]', sourceId, err)
    })
  }

  async getDocTree(sourceId: string): Promise<DocTreeNode[]> {
    const nodes = await listDocTree(sourceId, this.cfg())
    return buildTree(nodes)
  }

  async readDocument(sourceId: string, path: string): Promise<string> {
    return readDocFile(sourceId, path, this.cfg())
  }

  getSyncProgress(sourceId?: string): SyncProgress | SyncProgress[] | null {
    if (sourceId) return getSyncProgress(sourceId)
    return getAllActiveSyncProgress()
  }

  getAnySyncProgress(): SyncProgress | null {
    const all = getAllActiveSyncProgress()
    return all[0] ?? null
  }

  async getSyncLogs(): Promise<SyncLogEntry[]> {
    const config = this.cfg()
    const lines = await readSyncLogs(null, config)
    const records = await listSourceRecords(config)
    const nameMap = new Map(records.map((r) => [r.id, r.name]))
    return toSyncLogEntries(lines, nameMap)
  }

  async getSettings(): Promise<AppSettings> {
    this.config = await loadConfig()
    return toUiSettings(this.config)
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await loadConfig()
    const next: AppConfig = {
      ...current,
      dataDir: partial.dataDir ?? current.dataDir,
      mcp: { ...current.mcp, ...partial.mcp },
      crawl: {
        ...current.crawl,
        respectRobots: partial.crawl?.respectRobots ?? current.crawl.respectRobots,
        concurrency: partial.crawl?.concurrency ?? current.crawl.concurrency,
        requestTimeoutMs: partial.crawl?.requestTimeoutMs ?? current.crawl.requestTimeoutMs,
        userAgent: partial.crawl?.userAgent ?? current.crawl.userAgent,
        defaultHeaders: partial.crawl?.defaultHeaders ?? current.crawl.defaultHeaders,
        rateLimit: {
          ...current.crawl.rateLimit,
          mode: partial.crawl?.rateLimitMode ?? current.crawl.rateLimit.mode,
          fixedMs: partial.crawl?.rateLimitFixedMs ?? current.crawl.rateLimit.fixedMs,
          randomMinMs: partial.crawl?.rateLimitRandomMinMs ?? current.crawl.rateLimit.randomMinMs,
          randomMaxMs: partial.crawl?.rateLimitRandomMaxMs ?? current.crawl.rateLimit.randomMaxMs
        }
      },
      ui: { ...current.ui, ...partial.ui }
    }
    await saveConfig(next)
    this.config = next
    return toUiSettings(next)
  }

  async searchDocuments(query: string, sourceId: string | null): Promise<SearchResult[]> {
    const config = this.cfg()
    const raw = searchKeyword(query.trim(), sourceId, config)
    // 补充 sourceName：批量读取已知源名
    const records = await listSourceRecords(config)
    const nameMap = new Map(records.map((r) => [r.id, r.name]))
    return raw.map((r) => ({
      sourceId: r.sourceId,
      sourceName: nameMap.get(r.sourceId) ?? r.sourceId,
      docPath: r.docPath,
      title: r.title,
      snippet: r.snippet
    }))
  }

  async testMcpConnection(host: string, port: number): Promise<boolean> {
    try {
      const res = await fetch(mcpHealthUrl(host, port), {
        signal: AbortSignal.timeout(5000)
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export const sourceManager = new SourceManager()
