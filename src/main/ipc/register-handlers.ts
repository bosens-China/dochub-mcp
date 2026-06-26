import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { mcpHealthUrl } from '@shared/constants/mcp'
import type { AddSourceInput, AppSettings, UpdateSourceInput } from '@shared/types'
import { sourceManager } from '../services/source/manager'

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
  return { name: name.trim(), seedUrl: seedUrl.trim(), crawlMode }
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
    maxRetriesPerUrl: raw.maxRetriesPerUrl
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

  ipcMain.handle(IPC_CHANNELS.sync.progress, () => {
    const result = sourceManager.getSyncProgress()
    return Array.isArray(result) ? result : result ? [result] : []
  })

  ipcMain.handle(IPC_CHANNELS.sync.logs, () => sourceManager.getSyncLogs())

  ipcMain.handle(IPC_CHANNELS.settings.get, () => sourceManager.getSettings())

  ipcMain.handle(IPC_CHANNELS.settings.update, (_event, partial: unknown) => {
    return sourceManager.updateSettings(assertSettingsPartial(partial))
  })

  ipcMain.handle(IPC_CHANNELS.docs.search, (_event, query: unknown, sourceId: unknown) => {
    if (typeof query !== 'string' || !query.trim()) {
      throw new Error('搜索关键词不能为空')
    }
    const sid = sourceId === null || sourceId === undefined ? null : String(sourceId)
    return sourceManager.searchDocuments(query, sid)
  })

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
