import { readFile, writeFile, readdir, rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { AppConfig } from '@shared/types/config'
import type { SyncProgress } from '@shared/types'
import { discoverSeedUrls } from '../discovery/index'
import { fetchRobotsTxt, type FetchOptions } from '../crawler/fetcher'
import { removeDocumentIndex } from '../indexer/fts'
import { appendSyncLog, createCheckpoint, loadCheckpoint } from '../sync/persistence'
import { getCheckpointPath } from '../../config/paths'
import { readSourceRecord, sourceDocsDir, sourceTreePath, writeSourceRecord } from '../source/store'
import { runConcurrentCrawl } from '../sync/orchestrator'
import { finalizeSourceDocuments } from '../sync/finalize'
import { extractDocBody } from '../converter/doc-frontmatter'

const activeSyncs = new Map<string, SyncProgress>()
const syncLocks = new Set<string>()

export function getSyncProgress(sourceId: string): SyncProgress | null {
  return activeSyncs.get(sourceId) ?? null
}

export function getAnyActiveSyncProgress(): SyncProgress | null {
  for (const p of activeSyncs.values()) {
    if (p.completed < p.total || p.phase !== 'finalizing') return p
  }
  return null
}

export function getAllActiveSyncProgress(): SyncProgress[] {
  return [...activeSyncs.values()]
}

function patchProgress(sourceId: string, patch: Partial<SyncProgress> & Pick<SyncProgress, 'phase' | 'message'>): void {
  const prev = activeSyncs.get(sourceId)
  activeSyncs.set(sourceId, {
    sourceId,
    phase: patch.phase,
    message: patch.message,
    total: patch.total ?? prev?.total ?? 0,
    completed: patch.completed ?? prev?.completed ?? 0,
    failed: patch.failed ?? prev?.failed ?? 0,
    currentUrl: patch.currentUrl !== undefined ? patch.currentUrl : (prev?.currentUrl ?? null)
  })
}

async function buildTreeTxt(sourceId: string, config: AppConfig): Promise<void> {
  const docsRoot = sourceDocsDir(sourceId, config)
  if (!existsSync(docsRoot)) return

  const lines: string[] = []
  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        lines.push(`${rel}/`)
        await walk(join(dir, entry.name), rel)
      } else if (entry.name.endsWith('.md')) {
        lines.push(rel)
      }
    }
  }
  await walk(docsRoot, '')
  const record = await readSourceRecord(sourceId, config)
  const header = record ? `${record.name} (${lines.length} files)` : sourceId
  await writeFile(sourceTreePath(sourceId, config), `${header}\n${lines.join('\n')}\n`, 'utf8')
}

export async function runSourceSync(sourceId: string, config: AppConfig): Promise<void> {
  if (syncLocks.has(sourceId)) {
    throw new Error('该源正在同步中')
  }
  syncLocks.add(sourceId)

  let record = await readSourceRecord(sourceId, config)
  if (!record) {
    syncLocks.delete(sourceId)
    throw new Error(`文档源不存在: ${sourceId}`)
  }

  const started = Date.now()
  record = {
    ...record,
    sync: { ...record.sync, status: 'syncing' },
    updatedAt: new Date().toISOString()
  }
  await writeSourceRecord(record, config)

  patchProgress(sourceId, {
    phase: 'preparing',
    message: '准备同步…',
    total: 0,
    completed: 0,
    failed: 0,
    currentUrl: null
  })

  const crawl = {
    ...config.crawl,
    respectRobots: record.crawl.respectRobots ?? config.crawl.respectRobots,
    maxRetriesPerUrl: record.crawl.maxRetriesPerUrl ?? config.crawl.maxRetriesPerUrl,
    domainFailureThreshold:
      record.crawl.domainFailureThreshold ?? config.crawl.domainFailureThreshold,
    concurrency: record.crawl.concurrency ?? config.crawl.concurrency,
    rateLimit: { ...config.crawl.rateLimit, ...record.crawl.rateLimit },
    defaultHeaders: {
      ...config.crawl.defaultHeaders,
      ...record.crawl.customHeaders
    }
  }

  const fetchOpts: FetchOptions = {
    crawl,
    customHeaders: record.crawl.customHeaders
  }

  try {
    if (crawl.respectRobots) {
      patchProgress(sourceId, {
        phase: 'preparing',
        message: `正在读取 ${record.discovery.domain} 的 robots.txt…`
      })
    }

    const robotsTxt = crawl.respectRobots
      ? await fetchRobotsTxt(record.discovery.domain, crawl)
      : null

    let checkpoint = await loadCheckpoint(sourceId, config)
    if (!checkpoint || checkpoint.status !== 'running') {
      patchProgress(sourceId, {
        phase: 'discovering',
        message: '正在发现待爬取 URL…'
      })

      const seedUrls = await discoverSeedUrls(
        record.seedUrl,
        record.scope.prefix,
        crawl,
        record.crawl.customHeaders,
        (message) => {
          patchProgress(sourceId, { phase: 'discovering', message })
        }
      )
      checkpoint = createCheckpoint(sourceId, seedUrls)
    }

    const initialTotal = checkpoint.pending.length + Object.keys(checkpoint.completed).length
    patchProgress(sourceId, {
      phase: 'crawling',
      message: `开始爬取，共 ${initialTotal} 个 URL`,
      total: initialTotal,
      completed: Object.keys(checkpoint.completed).length,
      failed: Object.keys(checkpoint.failed).length,
      currentUrl: checkpoint.pending[0] ?? null
    })

    const { completed, failed, status } = await runConcurrentCrawl({
      sourceId,
      config,
      record,
      crawl,
      fetchOpts,
      robotsTxt,
      checkpoint,
      onProgress: (progress) => patchProgress(sourceId, progress)
    })

    patchProgress(sourceId, {
      phase: 'finalizing',
      message: '正在清理已删除页面…',
      total: Object.keys(completed).length,
      completed: Object.keys(completed).length,
      failed: Object.keys(failed).length,
      currentUrl: null
    })

    const currentPaths = new Set(Object.values(completed).map((c) => c.path))
    await deleteRemovedDocs(sourceId, currentPaths, config)

    patchProgress(sourceId, {
      phase: 'finalizing',
      message: '正在建立搜索索引…'
    })

    record = (await readSourceRecord(sourceId, config)) ?? record
    record = {
      ...record,
      sync: {
        ...record.sync,
        status,
        lastSyncAt: new Date().toISOString(),
        lastSyncDurationMs: Date.now() - started,
        pageCount: Object.keys(completed).length,
        failedUrlCount: Object.keys(failed).length
      },
      updatedAt: new Date().toISOString()
    }
    await writeSourceRecord(record, config)

    patchProgress(sourceId, {
      phase: 'finalizing',
      message: '正在本地化文档链接…'
    })

    await finalizeSourceDocuments(sourceId, config, record, completed)

    patchProgress(sourceId, {
      phase: 'finalizing',
      message: '正在生成目录树…'
    })

    await buildTreeTxt(sourceId, config)

    const checkpointPath = getCheckpointPath(sourceId, config)
    if (existsSync(checkpointPath)) {
      await rm(checkpointPath, { force: true })
    }
  } catch (err) {
    record = (await readSourceRecord(sourceId, config)) ?? record
    record.sync.status = 'failed'
    record.updatedAt = new Date().toISOString()
    await writeSourceRecord(record, config)
    await appendSyncLog(
      {
        ts: new Date().toISOString(),
        sourceId,
        action: 'fail',
        reason: err instanceof Error ? err.message : String(err)
      },
      config
    )
    throw err
  } finally {
    activeSyncs.delete(sourceId)
    syncLocks.delete(sourceId)
  }
}

export async function listDocTree(
  sourceId: string,
  config: AppConfig
): Promise<Array<{ key: string; title: string; isLeaf?: boolean }>> {
  const docsRoot = sourceDocsDir(sourceId, config)
  if (!existsSync(docsRoot)) return []

  const nodes: Array<{ key: string; title: string; isLeaf?: boolean }> = []

  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        nodes.push({ key: rel, title: entry.name })
        await walk(join(dir, entry.name), rel)
      } else if (entry.name.endsWith('.md')) {
        nodes.push({ key: `docs/${rel}`, title: entry.name, isLeaf: true })
      }
    }
  }
  await walk(docsRoot, '')
  return nodes
}

export async function readDocFile(
  sourceId: string,
  docPath: string,
  config: AppConfig
): Promise<string> {
  const relativePath = docPath.replace(/^docs\//, '')
  const fullPath = join(sourceDocsDir(sourceId, config), relativePath)
  if (!existsSync(fullPath)) {
    throw new Error('文档不存在')
  }
  const raw = await readFile(fullPath, 'utf8')
  return extractDocBody(raw)
}

export async function deleteRemovedDocs(
  sourceId: string,
  currentPaths: Set<string>,
  config: AppConfig
): Promise<void> {
  const docsRoot = sourceDocsDir(sourceId, config)
  if (!existsSync(docsRoot)) return

  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const docKey = `docs/${rel}`
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), rel)
      } else if (entry.name.endsWith('.md') && !currentPaths.has(docKey)) {
        await rm(join(dir, entry.name))
        removeDocumentIndex(sourceId, docKey, config)
        await appendSyncLog(
          {
            ts: new Date().toISOString(),
            sourceId,
            action: 'delete',
            path: docKey,
            reason: 'removed_from_site'
          },
          config
        )
      }
    }
  }
  await walk(docsRoot, '')
}
