import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { mcpHealthUrl } from '@shared/constants/mcp'
import type {
  AddSourceInput,
  AppSettings,
  CrawlMode,
  SourceScheduleInput,
  SearchMode,
  UpdateSourceInput
} from '@shared/types'
import { sourceManager } from '../services/source/manager'
import { loadConfig } from '../config'
import { getMcpStatus, restartMcpServer } from '../services/mcp/lifecycle'
import { readAppLogs, setLoggerConfig } from '../services/logger/app-logger'
import { getOllamaStatus } from '../services/ollama/client'
import { getVectorIndexStatus } from '../services/indexer/vector-queue'

const MCP_TEST_TIMEOUT_MS = 5_000

async function testMcpConnection(host: string, port: number): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MCP_TEST_TIMEOUT_MS)

  try {
    const response = await fetch(mcpHealthUrl(host, port), {
      signal: controller.signal
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function assertAddSourceInput(input: unknown): AddSourceInput {
  if (!input || typeof input !== 'object') {
    throw new Error('无效的添加源参数')
  }
  const { name, seedUrl, crawlMode } = input as AddSourceInput
  if (!name?.trim() || !seedUrl?.trim()) {
    throw new Error('名称和起始 URL 不能为空')
  }
  new URL(seedUrl)
  if (!['ssr', 'spa', 'auto'].includes(crawlMode)) {
    throw new Error('无效的抓取模式')
  }
  return {
    name: name.trim(),
    seedUrl: seedUrl.trim(),
    crawlMode,
    maxPages: (input as AddSourceInput).maxPages ?? null,
    pathPrefix: (input as AddSourceInput).pathPrefix?.trim(),
    schedule: assertScheduleInput((input as { schedule?: unknown }).schedule)
  }
}

function assertScheduleInput(input: unknown): SourceScheduleInput | undefined {
  if (input === undefined || input === null) return undefined
  if (typeof input !== 'object') {
    throw new Error('无效的定时同步设置')
  }
  const raw = input as Partial<SourceScheduleInput>
  if (typeof raw.enabled !== 'boolean') {
    throw new Error('无效的定时同步开关')
  }
  if (typeof raw.interval !== 'number' || !Number.isInteger(raw.interval) || raw.interval < 1) {
    throw new Error('定时同步间隔须为正整数')
  }
  if (!raw.unit || !['hour', 'day', 'week', 'month'].includes(raw.unit)) {
    throw new Error('无效的定时同步单位')
  }
  return {
    enabled: raw.enabled,
    interval: raw.interval,
    unit: raw.unit
  }
}

function assertUpdateSourceInput(input: unknown): UpdateSourceInput {
  if (!input || typeof input !== 'object') {
    throw new Error('无效的更新源参数')
  }
  const raw = input as UpdateSourceInput
  if (typeof raw.id !== 'string' || !raw.id) {
    throw new Error('无效的文档源 ID')
  }
  if (raw.name !== undefined && !raw.name.trim()) {
    throw new Error('名称不能为空')
  }
  if (raw.seedUrl !== undefined) {
    new URL(raw.seedUrl)
  }
  if (raw.crawlMode !== undefined && !['ssr', 'spa', 'auto'].includes(raw.crawlMode)) {
    throw new Error('无效的抓取模式')
  }
  return {
    id: raw.id,
    name: raw.name?.trim(),
    seedUrl: raw.seedUrl?.trim(),
    crawlMode: raw.crawlMode,
    customHeaders: raw.customHeaders,
    excludePatterns: raw.excludePatterns,
    respectRobots: raw.respectRobots,
    concurrency: raw.concurrency,
    maxRetriesPerUrl: raw.maxRetriesPerUrl,
    maxPages: raw.maxPages,
    pathPrefix: raw.pathPrefix?.trim(),
    schedule: assertScheduleInput((input as { schedule?: unknown }).schedule)
  }
}

function assertSettingsPartial(partial: unknown): Partial<AppSettings> {
  if (!partial || typeof partial !== 'object') {
    throw new Error('无效的设置参数')
  }
  const raw = partial as Partial<AppSettings>

  if (raw.dataDir !== undefined && (typeof raw.dataDir !== 'string' || !raw.dataDir.trim())) {
    throw new Error('无效的数据目录')
  }

  if (raw.mcp !== undefined) {
    if (typeof raw.mcp !== 'object' || raw.mcp === null) {
      throw new Error('无效的 MCP 设置')
    }
    if (typeof raw.mcp.port === 'number' && (raw.mcp.port < 1 || raw.mcp.port > 65535)) {
      throw new Error('无效的 MCP 端口')
    }
  }

  if (raw.crawl !== undefined) {
    if (typeof raw.crawl !== 'object' || raw.crawl === null) {
      throw new Error('无效的爬取设置')
    }
    if (
      typeof raw.crawl.concurrency === 'number' &&
      (raw.crawl.concurrency < 1 || raw.crawl.concurrency > 10)
    ) {
      throw new Error('并发数须在 1–10 之间')
    }
  }

  if (raw.ui !== undefined && (typeof raw.ui !== 'object' || raw.ui === null)) {
    throw new Error('无效的 UI 设置')
  }

  if (raw.spaDetection !== undefined) {
    if (typeof raw.spaDetection !== 'object' || raw.spaDetection === null) {
      throw new Error('无效的 SPA 侦测设置')
    }
    if (
      typeof raw.spaDetection.autoRetryMinMdChars === 'number' &&
      raw.spaDetection.autoRetryMinMdChars < 0
    ) {
      throw new Error('SPA 自动重试阈值不能小于 0')
    }
  }

  if (raw.spaRender !== undefined) {
    if (typeof raw.spaRender !== 'object' || raw.spaRender === null) {
      throw new Error('无效的 SPA 渲染设置')
    }
    if (typeof raw.spaRender.timeoutMs === 'number' && raw.spaRender.timeoutMs < 1000) {
      throw new Error('SPA 渲染超时不能小于 1000ms')
    }
    if (
      raw.spaRender.waitUntil !== undefined &&
      !['domcontentloaded', 'load', 'networkidle'].includes(raw.spaRender.waitUntil)
    ) {
      throw new Error('无效的 SPA waitUntil')
    }
  }

  if (raw.ollama !== undefined) {
    if (typeof raw.ollama !== 'object' || raw.ollama === null) {
      throw new Error('无效的 Ollama 设置')
    }
    if (typeof raw.ollama.baseUrl === 'string') {
      new URL(raw.ollama.baseUrl)
    }
    if (
      typeof raw.ollama.embeddingConcurrency === 'number' &&
      (raw.ollama.embeddingConcurrency < 1 || raw.ollama.embeddingConcurrency > 8)
    ) {
      throw new Error('向量索引并发数须在 1–8 之间')
    }
    if (
      raw.ollama.rerank &&
      typeof raw.ollama.rerank === 'object' &&
      (raw.ollama.rerank.minScore < 0 || raw.ollama.rerank.minScore > 1)
    ) {
      throw new Error('Rerank minScore 须在 0–1 之间')
    }
  }

  return raw
}

export async function registerIpcHandlers(): Promise<void> {
  await sourceManager.init()

  ipcMain.handle(IPC_CHANNELS.sources.list, () => sourceManager.listSources())

  ipcMain.handle(IPC_CHANNELS.sources.get, (_event, id: unknown) => {
    if (typeof id !== 'string' || !id) {
      throw new Error('无效的文档源 ID')
    }
    return sourceManager.getSource(id)
  })

  ipcMain.handle(IPC_CHANNELS.sources.add, (_event, input: unknown) =>
    sourceManager.addSource(assertAddSourceInput(input))
  )

  ipcMain.handle(IPC_CHANNELS.sources.update, (_event, input: unknown) =>
    sourceManager.updateSource(assertUpdateSourceInput(input))
  )

  ipcMain.handle(IPC_CHANNELS.sources.detectSpa, (_event, seedUrl: unknown) => {
    if (typeof seedUrl !== 'string' || !seedUrl.trim()) {
      throw new Error('无效的起始 URL')
    }
    new URL(seedUrl)
    return sourceManager.detectSpa(seedUrl.trim())
  })

  ipcMain.handle(IPC_CHANNELS.sources.previewCrawl, (_event, url: unknown, mode: unknown) => {
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error('无效的 URL')
    }
    if (typeof mode !== 'string' || !['ssr', 'spa', 'auto'].includes(mode)) {
      throw new Error('无效的模式')
    }
    return sourceManager.previewCrawl(url.trim(), mode as CrawlMode)
  })

  ipcMain.handle(IPC_CHANNELS.sources.delete, (_event, id: unknown) => {
    if (typeof id !== 'string' || !id) {
      throw new Error('无效的文档源 ID')
    }
    return sourceManager.deleteSource(id)
  })

  ipcMain.handle(IPC_CHANNELS.sources.sync, (_event, sourceId: unknown) => {
    if (typeof sourceId !== 'string' || !sourceId) {
      throw new Error('无效的文档源 ID')
    }
    sourceManager.triggerSync(sourceId)
  })

  ipcMain.handle(IPC_CHANNELS.sources.pauseSync, (_event, sourceId: unknown) => {
    if (typeof sourceId !== 'string' || !sourceId) {
      throw new Error('无效的文档源 ID')
    }
    return sourceManager.pauseSync(sourceId)
  })

  ipcMain.handle(IPC_CHANNELS.docs.tree, (_event, sourceId: unknown) => {
    if (typeof sourceId !== 'string' || !sourceId) {
      throw new Error('无效的文档源 ID')
    }
    return sourceManager.getDocTree(sourceId)
  })

  ipcMain.handle(IPC_CHANNELS.docs.read, (_event, sourceId: unknown, path: unknown) => {
    if (typeof sourceId !== 'string' || !sourceId) {
      throw new Error('无效的文档源 ID')
    }
    if (typeof path !== 'string' || !path) {
      throw new Error('无效的文件路径')
    }
    return sourceManager.readDocument(sourceId, path)
  })

  ipcMain.handle(IPC_CHANNELS.docs.openFolder, (_event, sourceId: unknown, path: unknown) => {
    if (typeof sourceId !== 'string' || !sourceId) {
      throw new Error('无效的文档源 ID')
    }
    if (typeof path !== 'string' || !path) {
      throw new Error('无效的文件路径')
    }
    return sourceManager.openFolder(sourceId, path)
  })

  ipcMain.handle(IPC_CHANNELS.sync.progress, () => {
    const result = sourceManager.getSyncProgress()
    return Array.isArray(result) ? result : result ? [result] : []
  })

  ipcMain.handle(IPC_CHANNELS.sync.logs, () => sourceManager.getSyncLogs())

  ipcMain.handle(IPC_CHANNELS.settings.get, () => sourceManager.getSettings())

  ipcMain.handle(IPC_CHANNELS.settings.update, async (_event, partial: unknown) => {
    const validated = assertSettingsPartial(partial)
    const settings = await sourceManager.updateSettings(validated)
    // Re-point logger + restart MCP when relevant config changed.
    if (validated.dataDir !== undefined || validated.mcp !== undefined) {
      const config = await loadConfig()
      setLoggerConfig(config)
      if (validated.mcp !== undefined) {
        await restartMcpServer(config)
      }
    }
    return settings
  })

  ipcMain.handle(IPC_CHANNELS.logs.app, async () => {
    const config = await loadConfig()
    return readAppLogs(config)
  })

  ipcMain.handle(IPC_CHANNELS.mcp.getStatus, () => getMcpStatus())

  ipcMain.handle(IPC_CHANNELS.ollama.getStatus, async () => {
    const config = await loadConfig()
    return getOllamaStatus(config.ollama, getVectorIndexStatus(config))
  })

  ipcMain.handle(
    IPC_CHANNELS.docs.search,
    (
      _event,
      query: unknown,
      sourceId: unknown,
      mode: unknown,
      limit: unknown,
      rerank: unknown,
      minScore: unknown
    ) => {
      if (typeof query !== 'string' || !query.trim()) {
        throw new Error('搜索关键词不能为空')
      }
      const sid = sourceId === null || sourceId === undefined ? null : String(sourceId)
      const searchMode =
        mode === undefined ? 'keyword' : typeof mode === 'string' ? mode : 'keyword'
      if (!['keyword', 'semantic', 'hybrid'].includes(searchMode)) {
        throw new Error('无效的搜索模式')
      }
      const max = typeof limit === 'number' ? limit : undefined
      if (rerank !== undefined && typeof rerank !== 'boolean') {
        throw new Error('无效的 Rerank 参数')
      }
      if (
        minScore !== undefined &&
        (typeof minScore !== 'number' || minScore < 0 || minScore > 1)
      ) {
        throw new Error('Rerank minScore 须在 0–1 之间')
      }
      return sourceManager.searchDocuments(query, sid, searchMode as SearchMode, max, {
        enabled: rerank,
        minScore
      })
    }
  )

  ipcMain.handle(IPC_CHANNELS.mcp.testConnection, (_event, host: unknown, port: unknown) => {
    if (typeof host !== 'string' || !host) {
      throw new Error('无效的主机地址')
    }
    if (typeof port !== 'number' || port < 1 || port > 65535) {
      throw new Error('无效的端口号')
    }
    return testMcpConnection(host, port)
  })
}
