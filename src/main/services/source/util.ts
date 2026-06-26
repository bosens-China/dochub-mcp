import { createHash } from 'crypto'
import { SPINE_COLORS } from '@shared/constants/spine-colors'
import type { DocSource, SourceDetail, SourceRecord } from '@shared/types'

export function spineColorForId(id: string): string {
  const hash = createHash('sha256').update(id).digest()
  const index = hash[0] % SPINE_COLORS.length
  return SPINE_COLORS[index] ?? SPINE_COLORS[0]
}

export function slugFromUrl(seedUrl: string): string {
  const url = new URL(seedUrl)
  const parts = url.pathname.split('/').filter(Boolean)
  const host = url.hostname.replace(/\./g, '-')
  const tail = parts.slice(-2).join('-') || 'root'
  return `${host}-${tail}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

export function toDocSource(record: SourceRecord): DocSource {
  return {
    id: record.id,
    name: record.name,
    seedUrl: record.seedUrl,
    pathPrefix: record.scope.prefix,
    status: record.sync.status,
    lastSyncedAt: record.sync.lastSyncAt,
    pageCount: record.sync.pageCount,
    failedCount: record.sync.failedUrlCount,
    crawlMode: record.crawl.mode,
    spineColor: spineColorForId(record.id)
  }
}

export function toSourceDetail(record: SourceRecord): SourceDetail {
  return {
    ...toDocSource(record),
    customHeaders: record.crawl.customHeaders,
    excludePatterns: record.crawl.excludePatterns,
    respectRobots: record.crawl.respectRobots ?? true,
    concurrency: record.crawl.concurrency,
    maxRetriesPerUrl: record.crawl.maxRetriesPerUrl
  }
}

export function pathPrefixFromSeed(seedUrl: string): string {
  const url = new URL(seedUrl)
  let prefix = url.pathname
  if (!prefix.endsWith('/')) {
    prefix = `${prefix}/`
  }
  return prefix
}

export function isInScope(url: string, prefix: string): boolean {
  try {
    const parsed = new URL(url)
    if (prefix.startsWith('http://') || prefix.startsWith('https://')) {
      const scopeUrl = new URL(prefix)
      if (parsed.origin !== scopeUrl.origin) return false
      return parsed.pathname.startsWith(scopeUrl.pathname)
    }
    const scopePath = prefix.startsWith('/') ? prefix : `/${prefix}`
    return parsed.pathname.startsWith(scopePath)
  } catch {
    return false
  }
}

export function urlToDocPath(url: string, scopePrefix: string): string {
  const parsed = new URL(url)
  let scopePath: string
  if (scopePrefix.startsWith('http://') || scopePrefix.startsWith('https://')) {
    scopePath = new URL(scopePrefix).pathname
  } else {
    scopePath = scopePrefix.startsWith('/') ? scopePrefix : `/${scopePrefix}`
  }
  let relative = parsed.pathname.slice(scopePath.length)
  if (relative.startsWith('/')) relative = relative.slice(1)
  if (!relative || relative.endsWith('/')) {
    relative = `${relative}index.md`
  } else if (!relative.endsWith('.md')) {
    relative = `${relative}.md`
  }
  return `docs/${relative}`
}

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export function matchesExclude(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  try {
    const path = new URL(url).pathname
    return patterns.some((pattern) => {
      const re = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`)
      return re.test(path)
    })
  } catch {
    return false
  }
}
