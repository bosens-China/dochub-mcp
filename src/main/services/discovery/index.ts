import { load } from 'cheerio'
import picomatch from 'picomatch'
import type { CrawlConfig } from '@shared/types/config'
import type { OllamaConfig } from '@shared/types'
import { z } from 'zod'
import { isInScope } from '../source/util'
import { cachedText } from './domain-cache'
import { chatWithOllama } from '../ollama/client'

const StructuredLlmsItemSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  section: z.string().optional()
})

const StructuredLlmsResponseSchema = z
  .union([
    z.array(StructuredLlmsItemSchema),
    z.object({
      urls: z.array(StructuredLlmsItemSchema)
    })
  ])
  .transform((value) => (Array.isArray(value) ? value : value.urls))

/** Fetch a URL's text (or null on non-2xx / error). Never throws. */
async function fetchTextOrNull(
  url: string,
  crawl: CrawlConfig,
  customHeaders: Record<string, string>
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': crawl.userAgent,
        ...crawl.defaultHeaders,
        ...customHeaders
      },
      signal: AbortSignal.timeout(crawl.requestTimeoutMs)
    })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

export function normalizeUrl(href: string, base: string): string | null {
  try {
    let url: URL
    if (href.startsWith('http://') || href.startsWith('https://')) {
      url = new URL(href)
    } else if (base.startsWith('http://') || base.startsWith('https://')) {
      url = new URL(href, base)
    } else {
      return null
    }
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}

export function filterUrls(
  urls: string[],
  scopePrefix: string,
  excludePatterns: string[] = []
): string[] {
  const isExcluded = picomatch(excludePatterns, { dot: true })
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of urls) {
    const normalized = normalizeUrl(raw, scopePrefix)
    if (!normalized || seen.has(normalized)) continue
    if (!isInScope(normalized, scopePrefix)) continue
    if (isExcluded(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

export function parseLlmsTxt(raw: string, scopePrefix: string): string[] {
  const urls: string[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const mdLink = trimmed.match(/\((https?:\/\/[^)]+)\)/)
    if (mdLink?.[1]) {
      urls.push(mdLink[1])
      continue
    }
    if (trimmed.startsWith('http')) {
      urls.push(trimmed.split(/\s+/)[0] ?? trimmed)
    }
  }
  return filterUrls(urls, scopePrefix)
}

async function parseLlmsTxtWithOllama(
  raw: string,
  scopePrefix: string,
  ollama?: OllamaConfig,
  onProgress?: DiscoverProgressCallback
): Promise<string[]> {
  if (!ollama?.enabled || !ollama.llmModel.trim()) return []

  try {
    onProgress?.('llms.txt 无法直接解析，正在尝试 Ollama 结构化…')
    const content = await chatWithOllama(
      ollama,
      [
        {
          role: 'system',
          content:
            'Extract documentation URLs from the user text. Return JSON only: [{"url":"https://example.com/docs/a","title":"A","section":"Guide"}].'
        },
        { role: 'user', content: raw.slice(0, 20_000) }
      ],
      { format: 'json' }
    )
    const parsed = JSON.parse(content) as unknown
    const items = StructuredLlmsResponseSchema.parse(parsed)
    return filterUrls(
      items.map((item) => item.url),
      scopePrefix
    )
  } catch {
    onProgress?.('Ollama 未能结构化 llms.txt，已跳过')
    return []
  }
}

export function parseSitemapXml(xml: string, scopePrefix: string): string[] {
  const $ = load(xml, { xmlMode: true })
  const urls: string[] = []
  $('loc').each((_, el) => {
    const text = $(el).text().trim()
    if (text) urls.push(text)
  })
  return filterUrls(urls, scopePrefix)
}

export function extractLinksFromHtml(html: string, pageUrl: string, scopePrefix: string): string[] {
  const $ = load(html)
  const seen = new Set<string>()
  const links: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    const normalized = normalizeUrl(href, pageUrl)
    if (!normalized || seen.has(normalized) || !isInScope(normalized, scopePrefix)) return
    seen.add(normalized)
    links.push(normalized)
  })
  return links
}

export type DiscoverProgressCallback = (message: string) => void

export async function discoverSeedUrls(
  seedUrl: string,
  scopePrefix: string,
  crawl: CrawlConfig,
  customHeaders: Record<string, string>,
  onProgress?: DiscoverProgressCallback,
  ollama?: OllamaConfig
): Promise<string[]> {
  const domain = new URL(seedUrl).origin
  const candidates = new Set<string>([seedUrl])

  onProgress?.(`正在解析站点 ${new URL(domain).hostname}…`)

  const llmsPaths = ['/llms-full.txt', '/llms.txt']
  for (const path of llmsPaths) {
    onProgress?.(`正在查找 ${path}…`)
    const text = await cachedText(`${domain}${path}`, () =>
      fetchTextOrNull(`${domain}${path}`, crawl, customHeaders)
    )
    if (text !== null) {
      let found = parseLlmsTxt(text, scopePrefix)
      if (found.length === 0) {
        found = await parseLlmsTxtWithOllama(text, scopePrefix, ollama, onProgress)
      }
      for (const u of found) candidates.add(u)
      if (found.length > 0) {
        onProgress?.(`从 ${path} 发现 ${found.length} 个 URL`)
      } else {
        onProgress?.(`${path} 中无符合范围的 URL`)
      }
      break
    }
  }

  onProgress?.('正在读取 sitemap.xml…')
  const sitemapXml = await cachedText(`${domain}/sitemap.xml`, () =>
    fetchTextOrNull(`${domain}/sitemap.xml`, crawl, customHeaders)
  )
  if (sitemapXml !== null) {
    const found = parseSitemapXml(sitemapXml, scopePrefix)
    for (const u of found) candidates.add(u)
    if (found.length > 0) {
      onProgress?.(`从 sitemap 发现 ${found.length} 个 URL`)
    } else {
      onProgress?.('sitemap 中无符合范围的 URL')
    }
  } else {
    onProgress?.('未找到 sitemap.xml，将从起始页链接发现')
  }

  const urls = filterUrls([...candidates], scopePrefix)
  onProgress?.(`共发现 ${urls.length} 个待爬取 URL`)
  return urls
}
