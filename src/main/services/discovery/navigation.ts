import { load, type CheerioAPI } from 'cheerio'
import { isInScope } from '../source/util'
import { normalizeUrl } from './index'

export interface DiscoveredNavigationItem {
  url: string
  title: string
  groups: string[]
  order: number
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function bestSidebar($: CheerioAPI): ReturnType<CheerioAPI> {
  let best = $('nav').first()
  let bestScore = -1

  $('nav').each((_, nav) => {
    const node = $(nav)
    const score = node.find('ul.sidebar-group').length * 10 + node.find('a[href]').length
    if (score > bestScore) {
      best = node
      bestScore = score
    }
  })

  return best
}

export function extractNavigationFromHtml(
  html: string,
  pageUrl: string,
  scopePrefix: string
): DiscoveredNavigationItem[] {
  const $ = load(html)
  const sidebar = bestSidebar($)
  const items: DiscoveredNavigationItem[] = []
  const seen = new Set<string>()
  let order = 0

  sidebar.find('ul.sidebar-group').each((_, ul) => {
    const list = $(ul)
    const section = list.parent()
    const groupTitle = cleanText(
      section.find('> .sidebar-group-header .sidebar-title, > .sidebar-group-header').first().text()
    )
    const groups = groupTitle ? [groupTitle] : []

    list.find('li > a[href]').each((__, link) => {
      const anchor = $(link)
      const href = anchor.attr('href')
      if (!href) return

      const url = normalizeUrl(href, pageUrl)
      if (!url || !isInScope(url, scopePrefix) || seen.has(url)) return

      const li = anchor.closest('li')
      const dataTitle = li.attr('data-title')
      const spanTitle = cleanText(anchor.find('span').first().text())
      const title = cleanText(dataTitle ?? '') || spanTitle || cleanText(anchor.text())
      if (!title) return

      seen.add(url)
      items.push({ url, title, groups, order })
      order += 1
    })
  })

  return items
}
