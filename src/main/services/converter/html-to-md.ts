import { htmlToMarkdown } from '@mdream/js'
import { withMinimalPreset } from '@mdream/js/preset/minimal'
import TurndownService from 'turndown'
import { gfm } from '@joplin/turndown-plugin-gfm'
import { load } from 'cheerio'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
turndown.use(gfm)

export interface ConvertOptions {
  html: string
  url: string
  title?: string
}

const NON_CONTENT_SELECTORS = [
  '[data-agent-docs-index]',
  '[aria-hidden="true"]',
  '[hidden]',
  '.sr-only',
  '.skip-to-content',
  'script',
  'style',
  'noscript',
  'nav',
  'footer',
  'header'
]

function readableHtml(html: string): string {
  const $ = load(html)
  $(NON_CONTENT_SELECTORS.join(',')).remove()

  const candidates = ['main', 'article', '[role="main"]', '.mdx-content', '.prose']
  for (const selector of candidates) {
    const node = $(selector).first()
    const text = node.text().replace(/\s+/g, ' ').trim()
    if (text.length > 200) {
      return $.html(node)
    }
  }

  return $.html()
}

export function htmlToMd(options: ConvertOptions): string {
  const { html, url, title } = options
  const contentHtml = readableHtml(html)
  try {
    const md = htmlToMarkdown(
      contentHtml,
      withMinimalPreset({
        origin: url,
        plugins: {
          frontmatter: false,
          filter: { exclude: ['nav', 'footer', 'header', '.sidebar', '[data-agent-docs-index]'] }
        }
      })
    )
    if (md.trim().length > 0) return md.trim()
  } catch {
    /* fallback */
  }

  const fallback = turndown.turndown(contentHtml)
  const heading = title ? `# ${title}\n\n` : ''
  return `${heading}${fallback}`.trim()
}

export function wrapDocumentMarkdown(meta: {
  sourceUrl: string
  originalUrl: string
  title: string
  contentHash: string
  body: string
}): string {
  const { sourceUrl, originalUrl, title, contentHash, body } = meta
  const syncedAt = new Date().toISOString()
  return `---
sourceUrl: ${sourceUrl}
originalUrl: ${originalUrl}
title: ${title.replace(/\n/g, ' ')}
contentHash: sha256:${contentHash}
syncedAt: ${syncedAt}
---

${body}
`
}
