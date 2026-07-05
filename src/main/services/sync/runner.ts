import { rm } from 'fs/promises'
import { existsSync } from 'fs'
import type { AppConfig } from '@shared/types/config'
import type { SyncProgress } from '@shared/types'
import { discoverSeedUrls } from '../discovery/index'
import { fetchRobotsTxt, type FetchOptions } from '../crawler/fetcher'
import {
  appendSyncLog,
  createCheckpoint,
  loadCheckpoint,
  saveCheckpoint
} from '../sync/persistence'
import { getCheckpointPath } from '../../config/paths'
import { readSourceRecord, writeSourceRecord } from '../source/store'
import { runConcurrentCrawl } from '../sync/orchestrator'
import { finalizeSourceDocuments } from '../sync/finalize'
import { detectSpa as runSpaDetect } from '../discovery/spa-detect'
import { fetchSiteMeta } from '../discovery/site-meta'
import { buildTreeTxt, deleteRemovedDocs } from './doc-files'
import { logger } from '../logger/app-logger'

const activeSyncs = new Map<string, SyncProgress>()
const syncLocks = new Set<string>()
const pauseRequests = new Set<string>()

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

export async function requestSourceSyncPause(sourceId: string, config: AppConfig): Promise<void> {
  if (syncLocks.has(sourceId)) {
    pauseRequests.add(sourceId)
    patchProgress(sourceId, {
      phase: 'crawling',
      message: '正在暂停：当前页面完成后会保存进度…'
    })
    return
  }

  const checkpoint = await loadCheckpoint(sourceId, config)
  if (checkpoint) {
    await saveCheckpoint(
      {
        ...checkpoint,
        status: 'paused',
        updatedAt: new Date().toISOString()
      },
      config
    )
  }

  const record = await readSourceRecord(sourceId, config)
  if (record) {
    await writeSourceRecord(
      {
        ...record,
        sync: { ...record.sync, status: 'paused' },
        updatedAt: new Date().toISOString()
      },
      config
    )
  }
}

function patchProgress(
  sourceId: string,
  patch: Partial<SyncProgress> & Pick<SyncProgress, 'phase' | 'message'>
): void {
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

export async function runSourceSync(sourceId: string, config: AppConfig): Promise<void> {
  if (syncLocks.has(sourceId)) {
    throw new Error('该源正在同步中')
  }
  syncLocks.add(sourceId)
  pauseRequests.delete(sourceId)

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
    },
    maxPages: record.crawl.maxPages
  }

  try {
    let effectiveCrawlMode = record.crawl.mode
    let needsSpa = false
    // 对 auto / ssr 模式做首屏 SPA 检测：auto 用于选定模式，ssr 用于给出「疑似 SPA」警告。
    if (effectiveCrawlMode !== 'spa') {
      patchProgress(sourceId, {
        phase: 'preparing',
        message: '正在检测页面类型…'
      })
      const detection = await runSpaDetect(record.seedUrl, crawl, record.crawl.customHeaders)
      if (record.crawl.mode === 'auto') {
        effectiveCrawlMode =
          detection.recommendedMode === 'auto' ? 'ssr' : detection.recommendedMode
      }
      if (effectiveCrawlMode === 'ssr' && detection.confidence === 'likely_spa') {
        needsSpa = true
        logger.warn('sync', `「${record.name}」疑似 SPA 站点，SSR 抓取内容可能不完整`, {
          seedUrl: record.seedUrl,
          score: detection.score,
          previewCharCount: detection.previewCharCount
        })
      }
    }

    const fetchOpts: FetchOptions = {
      crawl,
      customHeaders: record.crawl.customHeaders,
      crawlMode: effectiveCrawlMode
    }

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
    if (!checkpoint) {
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

      // 抓取站点元信息（title / charset / lang），立即持久化——后续 finalize 会重新读取 record。
      const siteMeta = await fetchSiteMeta(record.seedUrl, crawl, record.crawl.customHeaders)
      if (siteMeta.title || siteMeta.charset || siteMeta.lang) {
        record = {
          ...record,
          discovery: {
            ...record.discovery,
            siteTitle: siteMeta.title ?? record.discovery.siteTitle,
            charset: siteMeta.charset ?? record.discovery.charset,
            lang: siteMeta.lang ?? record.discovery.lang
          },
          updatedAt: new Date().toISOString()
        }
        await writeSourceRecord(record, config)
      }
    } else if (checkpoint.status === 'paused') {
      checkpoint = {
        ...checkpoint,
        status: 'running',
        updatedAt: new Date().toISOString()
      }
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

    const { completed, failed, navigation, status } = await runConcurrentCrawl({
      sourceId,
      config,
      record,
      crawl,
      fetchOpts,
      robotsTxt,
      checkpoint,
      onProgress: (progress) => patchProgress(sourceId, progress),
      shouldPause: () => pauseRequests.has(sourceId)
    })

    if (status === 'paused') {
      record = (await readSourceRecord(sourceId, config)) ?? record
      record = {
        ...record,
        sync: {
          ...record.sync,
          status: 'paused',
          lastSyncDurationMs: Date.now() - started,
          pageCount: Object.keys(completed).length,
          failedUrlCount: Object.keys(failed).length,
          needsSpa
        },
        updatedAt: new Date().toISOString()
      }
      await writeSourceRecord(record, config)
      patchProgress(sourceId, {
        phase: 'crawling',
        message: '已暂停，同步进度已保存',
        total: Object.keys(completed).length,
        completed: Object.keys(completed).length,
        failed: Object.keys(failed).length,
        currentUrl: null
      })
      return
    }

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
        failedUrlCount: Object.keys(failed).length,
        needsSpa
      },
      updatedAt: new Date().toISOString()
    }
    await writeSourceRecord(record, config)

    patchProgress(sourceId, {
      phase: 'finalizing',
      message: '正在本地化文档链接…'
    })

    await finalizeSourceDocuments(sourceId, config, record, completed, navigation)

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
    pauseRequests.delete(sourceId)
  }
}

export { deleteRemovedDocs, listDocTree, readDocContent, readDocFile } from './doc-files'
export { listNavigationDocTree } from './doc-files'
