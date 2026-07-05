import { load } from 'cheerio'
import type { CrawlConfig } from '@shared/types/config'

export interface SiteMeta {
  title?: string
  charset?: string
  lang?: string
}

/** Extract site-level metadata (title / charset / lang) from a page's HTML. */
export function extractSiteMeta(html: string, contentType?: string | null): SiteMeta {
  const $ = load(html)

  const title = $('title').first().text().trim() || undefined
  const lang = $('html').attr('lang')?.trim() || undefined

  let charset = $('meta[charset]').attr('charset')?.trim()
  if (!charset) {
    const httpEquiv = $('meta[http-equiv="Content-Type"]').attr('content')
    charset = httpEquiv?.match(/charset=([^;]+)/i)?.[1]?.trim()
  }
  if (!charset && contentType) {
    charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim()
  }

  return { title, charset: charset?.toLowerCase() || undefined, lang }
}

/** Fetch the seed page and extract site metadata. Never throws — returns {} on failure. */
export async function fetchSiteMeta(
  seedUrl: string,
  crawl: CrawlConfig,
  customHeaders: Record<string, string> = {}
): Promise<SiteMeta> {
  try {
    const res = await fetch(seedUrl, {
      headers: {
        'User-Agent': crawl.userAgent,
        ...crawl.defaultHeaders,
        ...customHeaders
      },
      signal: AbortSignal.timeout(crawl.requestTimeoutMs)
    })
    if (!res.ok) return {}
    const html = await res.text()
    return extractSiteMeta(html, res.headers.get('content-type'))
  } catch {
    return {}
  }
}
