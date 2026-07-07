import type { AppConfig } from '@shared/types/config'
import { shell } from 'electron'
import { isAbsolute, relative, resolve } from 'path'
import type {
  AddSourceInput,
  AppSettings,
  CrawlMode,
  DocContent,
  DocSource,
  DocTreeNode,
  SearchResult,
  SearchMode,
  SourceDetail,
  SpaDetectionResult,
  SyncLogEntry,
  SyncProgress,
  UpdateSourceInput
} from '@shared/types'
import { loadConfig, saveConfig, saveConfigReference, ensureDataDirs } from '../../config'
import { toDocSource, toSourceDetail } from '../source/util'
import {
  createAndWriteSourceRecord,
  deleteSourceRecord,
  listSourceRecords,
  readSourceRecord,
  sourceDocsDir,
  updateSourceRecord
} from '../source/store'
import {
  getAllActiveSyncProgress,
  getSyncProgress,
  listDocTree,
  listNavigationDocTree,
  requestSourceSyncPause,
  readDocContent,
  runSourceSync
} from '../sync/runner'
import { readSyncLogs } from '../sync/persistence'
import { detectSpa as runSpaDetect } from '../discovery/spa-detect'
import { fetchUrl } from '../crawler/fetcher'
import { htmlToMd } from '../converter/html-to-md'
import { searchKeyword } from '../indexer/fts'
import { searchSemantic, type VectorSearchResult } from '../indexer/vector'
import { buildTranslatedSearchQueries } from '../ollama/query-translation'
import { rerankSearchResults, type RerankOverrides } from '../ollama/rerank'
import { refreshSyncScheduler } from '../scheduler/sync-scheduler'
import { mcpHealthUrl } from '@shared/constants/mcp'
import { logger } from '../logger/app-logger'
import { toUiSettings } from './settings'
import { errorMessage, shouldFallbackToKeywordSearch } from './search-fallback'

const DEFAULT_SEARCH_LIMIT = 20
const MAX_SEARCH_LIMIT = 50
const RRF_K = 60

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
        const isLast = i === parts.length - 1
        existing = {
          key: path,
          title: isLast && node.isLeaf ? node.title : parts[i]!,
          isLeaf: isLast ? node.isLeaf : false,
          children: []
        }
        map.set(path, existing)
        current.push(existing)
      } else if (i === parts.length - 1 && node.isLeaf) {
        existing.title = node.title
        existing.isLeaf = true
      }
      current = existing.children ?? []
    }
  }
  return root
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
    level:
      line.action === 'fail' || line.action === 'domain_halt'
        ? 'error'
        : line.action === 'delete' || line.action === 'pause'
          ? 'warn'
          : 'info',
    message:
      line.message ??
      (line.reason === 'content_unchanged'
        ? '跳过：内容未变化'
        : line.reason === 'removed_from_site'
          ? '删除：远端已移除'
          : line.reason === 'domain_failure_threshold'
            ? '域名熔断：失败 URL 达到阈值'
            : line.reason === 'user_paused'
              ? '同步已暂停'
              : (line.reason ?? line.action)),
    timestamp: line.ts,
    url: line.url,
    path: line.path,
    reason: line.reason
  }))
}

function clampSearchLimit(limit?: number): number {
  if (!limit) return DEFAULT_SEARCH_LIMIT
  return Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.floor(limit)))
}

function searchKey(result: Pick<SearchResult, 'sourceId' | 'docPath'>): string {
  return `${result.sourceId}::${result.docPath}`
}

function fuseRankedResults(resultGroups: SearchResult[][], limit: number): SearchResult[] {
  const scores = new Map<string, { result: SearchResult; score: number }>()
  const add = (results: SearchResult[]): void => {
    results.forEach((result, index) => {
      const key = searchKey(result)
      const current = scores.get(key)
      const score = (current?.score ?? 0) + 1 / (RRF_K + index + 1)
      scores.set(key, { result: current?.result ?? result, score })
    })
  }

  for (const group of resultGroups) {
    add(group)
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ result, score }) => ({ ...result, score }))
}

function fuseSearchResults(
  keywordResults: SearchResult[],
  semanticResults: SearchResult[],
  limit: number,
  mode: SearchMode
): SearchResult[] {
  return fuseRankedResults([keywordResults, semanticResults], limit).map((result) => ({
    ...result,
    mode
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
    void refreshSyncScheduler(this.cfg())
    return source
  }

  async updateSource(input: UpdateSourceInput): Promise<DocSource> {
    const record = await updateSourceRecord(input, this.cfg())
    void refreshSyncScheduler(this.cfg())
    return toDocSource(record)
  }

  async detectSpa(seedUrl: string): Promise<SpaDetectionResult> {
    const config = this.cfg()
    const result = await runSpaDetect(
      seedUrl,
      config.crawl,
      config.crawl.defaultHeaders,
      config.spaDetection
    )
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

  async previewCrawl(url: string, mode: CrawlMode): Promise<string> {
    const config = this.cfg()
    const result = await fetchUrl(url, {
      crawl: config.crawl,
      crawlMode: mode,
      spaRender: config.spaRender
    })
    return htmlToMd({ html: result.body, url: result.finalUrl, title: url })
  }

  async deleteSource(id: string): Promise<void> {
    await deleteSourceRecord(id, this.cfg())
    void refreshSyncScheduler(this.cfg())
  }

  triggerSync(sourceId: string): void {
    const config = this.cfg()
    void runSourceSync(sourceId, config).catch((err) => {
      logger.error('sync', `同步失败: ${sourceId}`, {
        error: err instanceof Error ? err.message : String(err)
      })
    })
  }

  async pauseSync(sourceId: string): Promise<void> {
    await requestSourceSyncPause(sourceId, this.cfg())
  }

  async getDocTree(sourceId: string): Promise<DocTreeNode[]> {
    const navigationTree = await listNavigationDocTree(sourceId, this.cfg())
    if (navigationTree) return navigationTree

    const nodes = await listDocTree(sourceId, this.cfg())
    return buildTree(nodes)
  }

  async readDocument(sourceId: string, path: string): Promise<DocContent> {
    return readDocContent(sourceId, path, this.cfg())
  }

  async openFolder(sourceId: string, path: string): Promise<void> {
    if (!path.startsWith('docs/') || !path.endsWith('.md')) {
      throw new Error('无效的文件路径')
    }
    const config = this.cfg()
    const relativePath = path.replace(/^docs\//, '')
    const docsRoot = resolve(sourceDocsDir(sourceId, config))
    const fullPath = resolve(docsRoot, relativePath)
    const relToRoot = relative(docsRoot, fullPath)
    if (relToRoot.startsWith('..') || isAbsolute(relToRoot)) {
      throw new Error('无效的文件路径')
    }
    shell.showItemInFolder(fullPath)
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
      spaDetection: { ...current.spaDetection, ...partial.spaDetection },
      spaRender: { ...current.spaRender, ...partial.spaRender },
      ollama: {
        ...current.ollama,
        ...partial.ollama,
        queryTranslation: {
          ...current.ollama.queryTranslation,
          ...partial.ollama?.queryTranslation
        },
        rerank: {
          ...current.ollama.rerank,
          ...partial.ollama?.rerank
        }
      },
      ui: { ...current.ui, ...partial.ui }
    }
    await ensureDataDirs(next)
    await saveConfig(next)
    await saveConfigReference(next)
    this.config = next
    void refreshSyncScheduler(next)
    return toUiSettings(next)
  }

  async searchDocuments(
    query: string,
    sourceId: string | null,
    mode: SearchMode = 'keyword',
    limit?: number,
    rerankOverrides: RerankOverrides = {}
  ): Promise<SearchResult[]> {
    const config = this.cfg()
    const cleanQuery = query.trim()
    const max = clampSearchLimit(limit)
    const queries = await buildTranslatedSearchQueries(cleanQuery, config.ollama)
    const records = await listSourceRecords(config)
    const nameMap = new Map(records.map((r) => [r.id, r.name]))
    const nameFor = (id: string): string => nameMap.get(id) ?? id
    const toKeywordResults = (): SearchResult[] => {
      const groups = queries.map((searchQuery) =>
        searchKeyword(searchQuery, sourceId, config, max).map((r) => ({
          sourceId: r.sourceId,
          sourceName: nameFor(r.sourceId),
          docPath: r.docPath,
          title: r.title,
          snippet: r.snippet,
          mode: 'keyword' as const
        }))
      )
      return fuseRankedResults(groups, max).map((result) => ({ ...result, mode: 'keyword' }))
    }
    const toSemanticResult = (r: VectorSearchResult): SearchResult => ({
      sourceId: r.sourceId,
      sourceName: nameFor(r.sourceId),
      docPath: r.docPath,
      title: r.title,
      snippet: r.snippet,
      score: r.score,
      mode: 'semantic'
    })
    const toSemanticResults = async (): Promise<SearchResult[]> => {
      const groups: SearchResult[][] = []
      for (const searchQuery of queries) {
        groups.push(
          (await searchSemantic(searchQuery, sourceId, config, max)).map(toSemanticResult)
        )
      }
      return fuseRankedResults(groups, max).map((result) => ({ ...result, mode: 'semantic' }))
    }

    if (mode === 'keyword') {
      return rerankSearchResults(cleanQuery, toKeywordResults(), config.ollama, rerankOverrides)
    }

    let semanticResults: SearchResult[]
    try {
      semanticResults = await toSemanticResults()
    } catch (err) {
      if (!shouldFallbackToKeywordSearch(err)) throw err
      logger.warn('search', 'Ollama 不可用，搜索已降级为关键词模式', {
        mode,
        error: errorMessage(err)
      })
      return rerankSearchResults(cleanQuery, toKeywordResults(), config.ollama, {
        ...rerankOverrides,
        enabled: false
      })
    }
    if (mode === 'semantic') {
      return rerankSearchResults(cleanQuery, semanticResults, config.ollama, rerankOverrides)
    }

    return rerankSearchResults(
      cleanQuery,
      fuseSearchResults(toKeywordResults(), semanticResults, max, 'hybrid'),
      config.ollama,
      rerankOverrides
    )
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
