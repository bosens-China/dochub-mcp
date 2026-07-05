import type { CrawlMode } from '@shared/types'

export const CRAWL_MODE_SELECT_OPTIONS: Array<{ value: CrawlMode; label: string }> = [
  { value: 'auto', label: '自动判断（推荐）' },
  { value: 'ssr', label: '快速抓取（适合静态文档）' },
  { value: 'spa', label: '浏览器抓取（适合动态页面，较慢）' }
]

export const CONCRETE_CRAWL_MODE_OPTIONS: Array<{ value: CrawlMode; label: string }> = [
  { value: 'ssr', label: '快速抓取（静态页面）' },
  { value: 'spa', label: '浏览器抓取（动态页面，较慢）' }
]

export function crawlModeName(mode: CrawlMode): string {
  if (mode === 'ssr') return '快速抓取'
  if (mode === 'spa') return '浏览器抓取'
  return '自动判断'
}

export function crawlModeDetail(mode: CrawlMode): string {
  if (mode === 'ssr') return '直接读取页面 HTML，速度快，适合静态生成的文档站。'
  if (mode === 'spa') return '使用隐藏浏览器等待页面渲染，较慢，但适合动态加载正文的站点。'
  return '先检测首屏内容，再让你确认最终抓取方式。'
}
