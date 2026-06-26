import { load } from 'cheerio'
import type { AppConfig } from '@shared/types/config'
import type { SourceRecord } from '@shared/types'
import type { Checkpoint } from '@shared/types/checkpoint'
import type { SyncProgress } from '@shared/types'
import {
  computeRateDelay,
  fetchUrl,
  robotsCrawlDelay,
  sleep,
  type FetchOptions
} from '../crawler/fetcher'
import { extractLinksFromHtml } from '../discovery/index'
import { htmlToMd, wrapDocumentMarkdown } from '../converter/html-to-md'
import { appendSyncLog, saveCheckpoint } from '../sync/persistence'
import { contentHash, urlToDocPath, isInScope, matchesExclude } from '../source/util'
import { sourceDocsDir } from '../source/store'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

export interface CrawlContext {
  sourceId: string
  config: AppConfig
  record: SourceRecord
  crawl: AppConfig['crawl']
  fetchOpts: FetchOptions
  robotsTxt: string | null
  checkpoint: Checkpoint
  onProgress: (progress: SyncProgress) => void
}

async function writeDocFile(
  sourceId: string,
  docPath: string,
  content: string,
  config: AppConfig
): Promise<void> {
  const relativePath = docPath.replace(/^docs\//, '')
  const fullPath = join(sourceDocsDir(sourceId, config), relativePath)
  await mkdir(join(fullPath, '..'), { recursive: true })
  await writeFile(fullPath, content, 'utf8')
}

export async function runConcurrentCrawl(ctx: CrawlContext): Promise<{
  completed: Checkpoint['completed']
  failed: Checkpoint['failed']
  domainFailureCount: number
  status: SourceRecord['sync']['status']
}> {
  const { config, record, crawl, checkpoint } = ctx
  const queue: string[] = [...checkpoint.pending]
  const completed = { ...checkpoint.completed }
  const failed = { ...checkpoint.failed }
  let domainFailures = checkpoint.domainFailureCount
  const inFlight = new Map<string, Promise<void>>()
  const exclude = record.crawl.excludePatterns ?? []

  const reportProgress = (currentUrl: string | null): void => {
    const done = Object.keys(completed).length
    const total = queue.length + inFlight.size + done
    const failedCount = Object.keys(failed).length
    let message: string
    if (currentUrl) {
      const shortUrl = currentUrl.length > 64 ? `${currentUrl.slice(0, 63)}…` : currentUrl
      message = `正在爬取 (${done}/${Math.max(total, 1)})：${shortUrl}`
    } else if (inFlight.size > 0) {
      message = `正在爬取 (${done}/${Math.max(total, 1)})…`
    } else {
      message = `爬取队列处理中 (${done}/${Math.max(total, 1)})…`
    }
    ctx.onProgress({
      sourceId: ctx.sourceId,
      phase: 'crawling',
      message,
      total,
      completed: done,
      failed: failedCount,
      currentUrl
    })
  }

  const persistCheckpoint = async (): Promise<void> => {
    await saveCheckpoint(
      {
        ...checkpoint,
        updatedAt: new Date().toISOString(),
        pending: queue.filter((u) => !completed[u] && !inFlight.has(u)),
        completed,
        failed,
        domainFailureCount: domainFailures
      },
      config
    )
  }

  const processUrl = async (url: string): Promise<void> => {
    if (domainFailures >= crawl.domainFailureThreshold) return

    reportProgress(url)
    const robotsDelay = robotsCrawlDelay(ctx.robotsTxt, url, crawl.userAgent)
    await sleep(computeRateDelay(crawl, robotsDelay))

    let attempts = failed[url]?.attempts ?? 0
    let success = false

    while (attempts < crawl.maxRetriesPerUrl && !success) {
      attempts++
      try {
        const result = await fetchUrl(url, { ...ctx.fetchOpts, robotsTxt: ctx.robotsTxt })
        if (result.status === 429) {
          const retryAfter = Number(result.headers['retry-after'] ?? 5)
          await sleep(retryAfter * 1000)
          continue
        }
        if (result.status >= 400) throw new Error(`HTTP ${result.status}`)

        const docPath = urlToDocPath(result.finalUrl, record.scope.prefix)
        const title = load(result.body)('title').first().text().trim() || url
        const mdBody = htmlToMd({ html: result.body, url: result.finalUrl, title })
        const hash = contentHash(mdBody)
        const prev = completed[result.finalUrl]

        if (prev?.hash === hash) {
          // 内容未变化：保留 completed 记录（断点续爬需要），仅记日志
          completed[result.finalUrl] = prev
          await appendSyncLog(
            {
              ts: new Date().toISOString(),
              sourceId: ctx.sourceId,
              action: 'skip',
              url: result.finalUrl,
              path: docPath,
              reason: 'content_unchanged'
            },
            config
          )
        } else {
          const wrapped = wrapDocumentMarkdown({
            sourceUrl: record.seedUrl,
            originalUrl: result.finalUrl,
            title,
            contentHash: hash,
            body: mdBody
          })
          await writeDocFile(ctx.sourceId, docPath, wrapped, config)
          completed[result.finalUrl] = { hash, path: docPath }
          await appendSyncLog(
            {
              ts: new Date().toISOString(),
              sourceId: ctx.sourceId,
              action: prev ? 'update' : 'fetch',
              url: result.finalUrl,
              path: docPath
            },
            config
          )
        }

        const newLinks = extractLinksFromHtml(result.body, result.finalUrl, record.scope.prefix)
        for (const link of newLinks) {
          if (
            completed[link] ||
            failed[link] ||
            queue.includes(link) ||
            inFlight.has(link) ||
            !isInScope(link, record.scope.prefix) ||
            matchesExclude(link, exclude)
          ) {
            continue
          }
          queue.push(link)
        }

        success = true
        // 同时清理原始 url 和 finalUrl 的 failed 记录（处理重定向场景的 key 不一致）
        delete failed[url]
        if (result.finalUrl !== url) {
          delete failed[result.finalUrl]
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failed[url] = { attempts, lastError: message }
        if (attempts >= crawl.maxRetriesPerUrl) {
          domainFailures++
          await appendSyncLog(
            {
              ts: new Date().toISOString(),
              sourceId: ctx.sourceId,
              action: 'fail',
              url,
              reason: message
            },
            config
          )
        }
      }
    }

    await persistCheckpoint()
    reportProgress(null)
  }

  const schedule = (): void => {
    while (
      inFlight.size < crawl.concurrency &&
      queue.length > 0 &&
      domainFailures < crawl.domainFailureThreshold
    ) {
      const url = queue.shift()
      if (!url || completed[url] || inFlight.has(url)) continue
      if (matchesExclude(url, exclude)) continue

      const task = processUrl(url).finally(() => {
        inFlight.delete(url)
        schedule()
      })
      inFlight.set(url, task)
    }
  }

  schedule()

  while (inFlight.size > 0 || (queue.length > 0 && domainFailures < crawl.domainFailureThreshold)) {
    if (inFlight.size === 0 && queue.length > 0) schedule()
    if (inFlight.size === 0 && queue.length === 0) break
    await sleep(100)
  }

  await Promise.all(inFlight.values())

  let status: SourceRecord['sync']['status'] = 'completed'
  if (domainFailures >= crawl.domainFailureThreshold) {
    status = 'domain_halted'
    await appendSyncLog(
      {
        ts: new Date().toISOString(),
        sourceId: ctx.sourceId,
        action: 'domain_halt',
        reason: 'domain_failure_threshold'
      },
      config
    )
  }

  return { completed, failed, domainFailureCount: domainFailures, status }
}
