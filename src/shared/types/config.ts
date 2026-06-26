import { z } from 'zod'

export const RateLimitSchema = z.object({
  mode: z.enum(['fixed', 'random']).default('random'),
  fixedMs: z.number().default(500),
  randomMinMs: z.number().default(300),
  randomMaxMs: z.number().default(1500)
})

export const CrawlConfigSchema = z.object({
  respectRobots: z.boolean().default(true),
  maxRetriesPerUrl: z.number().default(3),
  domainFailureThreshold: z.number().default(3),
  concurrency: z.number().default(3),
  rateLimit: RateLimitSchema.prefault({}),
  requestTimeoutMs: z.number().default(30_000),
  maxRedirects: z.number().default(5),
  userAgent: z.string().default('DocHub/1.0 (+https://github.com/your-org/dochub-mcp)'),
  defaultHeaders: z.record(z.string(), z.string()).default({})
})

export const McpConfigSchema = z.object({
  enabled: z.boolean().default(true),
  host: z.string().default('127.0.0.1'),
  port: z.number().default(8276),
  autoStart: z.boolean().default(true)
})

export const ChunkConfigSchema = z.object({
  maxChars: z.number().default(10_000)
})

export const UiConfigSchema = z.object({
  closeToTray: z.boolean().default(true),
  language: z.enum(['zh-CN', 'en-US']).default('zh-CN')
})

export const AppConfigSchema = z.object({
  dataDir: z.string().default('~/dochub'),
  mcp: McpConfigSchema.prefault({}),
  chunk: ChunkConfigSchema.prefault({}),
  crawl: CrawlConfigSchema.prefault({}),
  ui: UiConfigSchema.prefault({})
})

export type AppConfig = z.infer<typeof AppConfigSchema>
export type CrawlConfig = z.infer<typeof CrawlConfigSchema>
export type RateLimitConfig = z.infer<typeof RateLimitSchema>

export function parseAppConfig(input?: unknown): AppConfig {
  const defaults = AppConfigSchema.parse({})
  if (!input || typeof input !== 'object') {
    return defaults
  }

  const raw = input as Partial<AppConfig>
  return AppConfigSchema.parse({
    ...defaults,
    ...raw,
    mcp: { ...defaults.mcp, ...raw.mcp },
    chunk: { ...defaults.chunk, ...raw.chunk },
    crawl: {
      ...defaults.crawl,
      ...raw.crawl,
      rateLimit: { ...defaults.crawl.rateLimit, ...raw.crawl?.rateLimit }
    },
    ui: { ...defaults.ui, ...raw.ui }
  })
}
