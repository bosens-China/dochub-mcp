import { fetch as undiciFetch } from 'undici'
import robotsParser from 'robots-parser'
import { parseAppConfig, type CrawlConfig, type SpaRenderConfig } from '@shared/types/config'
import type { CrawlMode } from '@shared/types'
import { fetchSpaHtml } from './spa-fetcher'
import { cachedText } from '../discovery/domain-cache'

export interface FetchResult {
  url: string
  finalUrl: string
  status: number
  headers: Record<string, string>
  body: string
}

export interface FetchOptions {
  crawl: CrawlConfig
  customHeaders?: Record<string, string>
  robotsTxt?: string | null
  crawlMode?: CrawlMode
  spaRender?: SpaRenderConfig
}

function headerRecord(headers: {
  forEach: (fn: (value: string, key: string) => void) => void
}): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value
  })
  return out
}

export async function fetchUrl(url: string, options: FetchOptions): Promise<FetchResult> {
  const { crawl, customHeaders = {}, robotsTxt = null, crawlMode } = options

  if (crawl.respectRobots && robotsTxt) {
    const robots = robotsParser(url, robotsTxt)
    if (!robots.isAllowed(url, crawl.userAgent)) {
      throw new Error(`robots.txt 禁止访问: ${url}`)
    }
  }

  if (crawlMode === 'spa') {
    const headers = { ...crawl.defaultHeaders, ...customHeaders }
    const userAgent =
      Object.entries(headers).find(([key]) => key.toLowerCase() === 'user-agent')?.[1] ??
      crawl.userAgent
    return fetchSpaHtml(url, options.spaRender ?? parseAppConfig({}).spaRender, userAgent, headers)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), crawl.requestTimeoutMs)

  try {
    const response = await undiciFetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': crawl.userAgent,
        Accept: 'text/html,application/xhtml+xml,text/plain,*/*',
        ...crawl.defaultHeaders,
        ...customHeaders
      },
      signal: controller.signal
    })

    const body = await response.text()
    return {
      url,
      finalUrl: response.url,
      status: response.status,
      headers: headerRecord(response.headers),
      body
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchRobotsTxt(origin: string, crawl: CrawlConfig): Promise<string | null> {
  return cachedText(`${origin}/robots.txt`, async () => {
    try {
      const res = await undiciFetch(`${origin}/robots.txt`, {
        headers: { 'User-Agent': crawl.userAgent },
        signal: AbortSignal.timeout(crawl.requestTimeoutMs)
      })
      if (res.ok) return await res.text()
    } catch {
      /* no robots */
    }
    return null
  })
}

export function robotsCrawlDelay(robotsTxt: string | null, url: string, ua: string): number | null {
  if (!robotsTxt) return null
  const robots = robotsParser(url, robotsTxt)
  const delay = robots.getCrawlDelay(ua)
  return delay != null ? delay * 1000 : null
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export function computeRateDelay(crawl: CrawlConfig, robotsDelayMs: number | null): number {
  const { rateLimit } = crawl
  let delay: number
  if (rateLimit.mode === 'fixed') {
    delay = rateLimit.fixedMs
  } else {
    delay = rateLimit.randomMinMs + Math.random() * (rateLimit.randomMaxMs - rateLimit.randomMinMs)
  }
  if (robotsDelayMs != null) {
    delay = Math.max(delay, robotsDelayMs)
  }
  return delay
}
