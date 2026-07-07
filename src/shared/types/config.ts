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

export const SpaDetectionConfigSchema = z.object({
  alwaysConfirm: z.boolean().default(false),
  ssrScoreMax: z.number().default(30),
  spaScoreMin: z.number().default(61),
  minBodyCharsForSsr: z.number().default(500),
  autoRetryMinMdChars: z.number().default(200)
})

export const SpaRenderConfigSchema = z.object({
  timeoutMs: z.number().default(30_000),
  waitUntil: z.enum(['domcontentloaded', 'load', 'networkidle']).default('networkidle'),
  settleMs: z.number().default(500),
  maxPages: z.number().int().min(1).max(10).default(3)
})

export const UiConfigSchema = z.object({
  closeToTray: z.boolean().default(true),
  language: z.enum(['zh-CN', 'en-US']).default('zh-CN')
})

export const OllamaConfigSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().default('http://127.0.0.1:11434'),
  embeddingModel: z.string().default('nomic-embed-text'),
  embeddingConcurrency: z.number().int().min(1).max(8).default(2),
  llmModel: z.string().default('qwen2.5:3b'),
  queryTranslation: z
    .object({
      enabled: z.boolean().default(false)
    })
    .prefault({}),
  rerank: z
    .object({
      enabled: z.boolean().default(false),
      model: z.string().default('bge-reranker-v2-m3'),
      minScore: z.number().min(0).max(1).default(0.6),
      topK: z.number().int().min(1).max(200).default(20)
    })
    .prefault({})
})

export const AppConfigSchema = z.object({
  dataDir: z.string().default('~/dochub'),
  mcp: McpConfigSchema.prefault({}),
  chunk: ChunkConfigSchema.prefault({}),
  crawl: CrawlConfigSchema.prefault({}),
  spaDetection: SpaDetectionConfigSchema.prefault({}),
  spaRender: SpaRenderConfigSchema.prefault({}),
  ollama: OllamaConfigSchema.prefault({}),
  ui: UiConfigSchema.prefault({})
})

export type AppConfig = z.infer<typeof AppConfigSchema>
export type CrawlConfig = z.infer<typeof CrawlConfigSchema>
export type OllamaConfig = z.infer<typeof OllamaConfigSchema>
export type RateLimitConfig = z.infer<typeof RateLimitSchema>
export type SpaDetectionConfig = z.infer<typeof SpaDetectionConfigSchema>
export type SpaRenderConfig = z.infer<typeof SpaRenderConfigSchema>

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
    spaDetection: { ...defaults.spaDetection, ...raw.spaDetection },
    spaRender: { ...defaults.spaRender, ...raw.spaRender },
    ollama: {
      ...defaults.ollama,
      ...raw.ollama,
      queryTranslation: {
        ...defaults.ollama.queryTranslation,
        ...raw.ollama?.queryTranslation
      },
      rerank: {
        ...defaults.ollama.rerank,
        ...raw.ollama?.rerank
      }
    },
    ui: { ...defaults.ui, ...raw.ui }
  })
}
