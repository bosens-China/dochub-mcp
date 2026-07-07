import type { AppConfig } from '@shared/types/config'
import type { AppSettings } from '@shared/types'

export function toUiSettings(config: AppConfig): AppSettings {
  return {
    dataDir: config.dataDir,
    mcp: config.mcp,
    crawl: {
      respectRobots: config.crawl.respectRobots,
      concurrency: config.crawl.concurrency,
      rateLimitMode: config.crawl.rateLimit.mode,
      rateLimitFixedMs: config.crawl.rateLimit.fixedMs,
      rateLimitRandomMinMs: config.crawl.rateLimit.randomMinMs,
      rateLimitRandomMaxMs: config.crawl.rateLimit.randomMaxMs,
      requestTimeoutMs: config.crawl.requestTimeoutMs,
      userAgent: config.crawl.userAgent,
      defaultHeaders: config.crawl.defaultHeaders
    },
    spaDetection: config.spaDetection,
    spaRender: config.spaRender,
    ollama: config.ollama,
    ui: config.ui
  }
}
