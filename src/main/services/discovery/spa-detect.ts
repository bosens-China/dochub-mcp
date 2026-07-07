import { load } from 'cheerio'
import type { CrawlConfig, SpaDetectionConfig } from '@shared/types/config'
import type { CrawlMode } from '@shared/types'
import { SPA_MARKDOWN_PREVIEW_THRESHOLD } from '@shared/constants/spa-detection'
import { fetchUrl, type FetchOptions } from '../crawler/fetcher'
import { htmlToMd } from '../converter/html-to-md'

const DEFAULT_SPA_DETECTION: SpaDetectionConfig = {
  alwaysConfirm: false,
  ssrScoreMax: 30,
  spaScoreMin: 61,
  minBodyCharsForSsr: 500,
  autoRetryMinMdChars: 200
}

export interface SpaSignal {
  id: string
  weight: number
  hit: boolean
  label: string
}

export interface SpaDetectionResult {
  confidence: 'likely_ssr' | 'uncertain' | 'likely_spa'
  score: number
  signals: SpaSignal[]
  recommendedMode: CrawlMode
  previewMarkdown: string
  previewCharCount: number
}

export function scoreSpaDetection(
  html: string,
  previewCharCount: number,
  config: Pick<SpaDetectionConfig, 'minBodyCharsForSsr'> = DEFAULT_SPA_DETECTION
): { score: number; signals: SpaSignal[] } {
  const $ = load(html)
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const charCount = bodyText.length
  const scriptCount = $('script[src]').length
  const htmlLower = html.toLowerCase()
  const minBodyChars = config.minBodyCharsForSsr

  const signals: SpaSignal[] = [
    {
      id: 'low_markdown_preview',
      weight: 45,
      hit: previewCharCount < SPA_MARKDOWN_PREVIEW_THRESHOLD,
      label: `Markdown 预览过短（<${SPA_MARKDOWN_PREVIEW_THRESHOLD} 字符，当前 ${previewCharCount}）`
    },
    {
      id: 'low_body_text',
      weight: 30,
      hit: charCount < minBodyChars,
      label: `正文过少（<${minBodyChars} 字符）`
    },
    {
      id: 'root_shell',
      weight: 25,
      hit: Boolean($('#app, #root, #__next').length && charCount < 800),
      label: '疑似 JS 壳页面'
    },
    {
      id: 'heavy_scripts',
      weight: 15,
      hit: scriptCount >= 5,
      label: `脚本较多（${scriptCount} 个）`
    },
    {
      id: 'framework_marker',
      weight: 20,
      hit: /__next_data__|__nuxt__|vitepress|docusaurus|data-reactroot/.test(htmlLower),
      label: '命中 SPA 框架特征'
    },
    {
      id: 'noscript_warning',
      weight: 10,
      hit: $('noscript').text().toLowerCase().includes('javascript'),
      label: '存在 noscript 提示'
    },
    {
      id: 'substantial_ssr_content',
      weight: -35,
      hit: charCount > 3000 && $('h2').length >= 2,
      label: 'SSR 正文充足'
    },
    {
      id: 'server_rendered_meta',
      weight: -10,
      hit: Boolean($('article, main').length && $('p').length >= 3),
      label: '语义化正文结构'
    }
  ]

  let score = 50
  for (const s of signals) {
    if (s.hit) score += s.weight
  }
  score = Math.max(0, Math.min(100, score))
  return { score, signals }
}

function confidenceFromScore(
  score: number,
  config: Pick<SpaDetectionConfig, 'ssrScoreMax' | 'spaScoreMin'>
): SpaDetectionResult['confidence'] {
  if (score <= config.ssrScoreMax) return 'likely_ssr'
  if (score >= config.spaScoreMin) return 'likely_spa'
  return 'uncertain'
}

function recommendedMode(confidence: SpaDetectionResult['confidence']): CrawlMode {
  if (confidence === 'likely_ssr') return 'ssr'
  if (confidence === 'likely_spa') return 'spa'
  return 'auto'
}

export async function detectSpa(
  seedUrl: string,
  crawl: CrawlConfig,
  customHeaders: Record<string, string> = {},
  spaDetection: SpaDetectionConfig = DEFAULT_SPA_DETECTION
): Promise<SpaDetectionResult> {
  const fetchOpts: FetchOptions = { crawl, customHeaders }
  const result = await fetchUrl(seedUrl, fetchOpts)
  const pageTitle = load(result.body)('title').first().text().trim()
  const previewMarkdown = htmlToMd({
    html: result.body,
    url: result.finalUrl,
    title: pageTitle
  })
  const previewCharCount = previewMarkdown.length
  const { score, signals } = scoreSpaDetection(result.body, previewCharCount, spaDetection)
  const confidence = confidenceFromScore(score, spaDetection)

  return {
    confidence,
    score,
    signals,
    recommendedMode: recommendedMode(confidence),
    previewMarkdown,
    previewCharCount
  }
}

export function shouldRetryWithSpa(
  html: string,
  markdownCharCount: number,
  spaDetection: SpaDetectionConfig
): boolean {
  if (markdownCharCount >= spaDetection.autoRetryMinMdChars) return false
  const { score } = scoreSpaDetection(html, markdownCharCount, spaDetection)
  return score >= spaDetection.spaScoreMin
}
