import { z } from 'zod'

export const CrawlModeSchema = z.enum(['ssr', 'spa', 'auto'])

export const SyncStatusSchema = z.enum([
  'idle',
  'syncing',
  'paused',
  'completed',
  'failed',
  'domain_halted'
])

export const SourceScopeSchema = z.object({
  type: z.literal('path_prefix'),
  prefix: z.string()
})

export const SourceCrawlSchema = z.object({
  mode: CrawlModeSchema.default('ssr'),
  respectRobots: z.boolean().optional(),
  maxRetriesPerUrl: z.number().optional(),
  domainFailureThreshold: z.number().optional(),
  concurrency: z.number().optional(),
  rateLimit: z
    .object({
      mode: z.enum(['fixed', 'random']),
      fixedMs: z.number().optional(),
      randomMinMs: z.number().optional(),
      randomMaxMs: z.number().optional()
    })
    .optional(),
  customHeaders: z.record(z.string(), z.string()).default({}),
  excludePatterns: z.array(z.string()).default([]),
  maxDepth: z.number().nullable().optional(),
  maxPages: z.number().nullable().optional()
})

export const SourceSyncSchema = z.object({
  status: SyncStatusSchema.default('idle'),
  lastSyncAt: z.string().nullable().default(null),
  lastSyncDurationMs: z.number().nullable().default(null),
  pageCount: z.number().default(0),
  failedUrlCount: z.number().default(0)
})

export const SourceRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  seedUrl: z.string().url(),
  scope: SourceScopeSchema,
  discovery: z.object({
    domain: z.string(),
    llmsFullUrl: z.string().optional(),
    llmsUrl: z.string().optional(),
    sitemapUrl: z.string().optional()
  }),
  crawl: SourceCrawlSchema,
  sync: SourceSyncSchema,
  createdAt: z.string(),
  updatedAt: z.string()
})

export type CrawlMode = z.infer<typeof CrawlModeSchema>
export type SyncStatus = z.infer<typeof SyncStatusSchema>
export type SourceRecord = z.infer<typeof SourceRecordSchema>
export type SourceCrawl = z.infer<typeof SourceCrawlSchema>
export type SourceSync = z.infer<typeof SourceSyncSchema>

export interface AddSourceInput {
  name: string
  seedUrl: string
  crawlMode: CrawlMode
}

export interface UpdateSourceInput {
  id: string
  name?: string
  seedUrl?: string
  crawlMode?: CrawlMode
  customHeaders?: Record<string, string>
  excludePatterns?: string[]
  respectRobots?: boolean
  concurrency?: number
  maxRetriesPerUrl?: number
}

export interface SpaDetectionResult {
  confidence: 'likely_ssr' | 'uncertain' | 'likely_spa'
  score: number
  recommendedMode: CrawlMode
  previewCharCount: number
  previewMarkdown: string
  signals: Array<{ id: string; hit: boolean; label: string; weight: number }>
}

/** UI-facing source summary */
export interface DocSource {
  id: string
  name: string
  seedUrl: string
  pathPrefix: string
  status: SyncStatus
  lastSyncedAt: string | null
  pageCount: number
  failedCount: number
  crawlMode: CrawlMode
  spineColor: string
}

export interface SourceDetail extends DocSource {
  customHeaders: Record<string, string>
  excludePatterns: string[]
  respectRobots: boolean
  concurrency?: number
  maxRetriesPerUrl?: number
}

export interface DocTreeNode {
  key: string
  title: string
  isLeaf?: boolean
  children?: DocTreeNode[]
}

export type SyncPhase = 'preparing' | 'discovering' | 'crawling' | 'finalizing'

export interface SyncProgress {
  sourceId: string
  phase: SyncPhase
  /** 面向用户的当前步骤描述 */
  message: string
  total: number
  completed: number
  failed: number
  currentUrl: string | null
}

export type SyncLogLevel = 'info' | 'warn' | 'error'

export type SyncLogAction = 'fetch' | 'skip' | 'update' | 'delete' | 'fail' | 'domain_halt'

export interface SyncLogEntry {
  id: string
  sourceId: string
  sourceName: string
  action: SyncLogAction
  level: SyncLogLevel
  message: string
  timestamp: string
  url?: string
  path?: string
  reason?: string
}

export interface AppSettings {
  dataDir: string
  mcp: {
    enabled: boolean
    host: string
    port: number
    autoStart: boolean
  }
  crawl: {
    respectRobots: boolean
    concurrency: number
    rateLimitMode: 'fixed' | 'random'
    rateLimitFixedMs: number
    rateLimitRandomMinMs: number
    rateLimitRandomMaxMs: number
    requestTimeoutMs: number
    userAgent: string
    defaultHeaders: Record<string, string>
  }
  ui: {
    closeToTray: boolean
    language: 'zh-CN' | 'en-US'
  }
}

/** 关键词搜索结果条目 */
export interface SearchResult {
  sourceId: string
  sourceName: string
  docPath: string
  title: string
  snippet: string
}
