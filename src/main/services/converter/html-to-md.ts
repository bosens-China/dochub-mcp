import { htmlToMarkdown } from '@mdream/js'
import { withMinimalPreset } from '@mdream/js/preset/minimal'
import TurndownService from 'turndown'
import { gfm } from '@joplin/turndown-plugin-gfm'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
turndown.use(gfm)

export interface ConvertOptions {
  html: string
  url: string
  title?: string
}

export function htmlToMd(options: ConvertOptions): string {
  const { html, url, title } = options
  try {
    const md = htmlToMarkdown(
      html,
      withMinimalPreset({
        origin: url,
        plugins: {
          frontmatter: false,
          filter: { exclude: ['nav', 'footer', 'header', '.sidebar'] }
        }
      })
    )
    if (md.trim().length > 0) return md.trim()
  } catch {
    /* fallback */
  }

  const fallback = turndown.turndown(html)
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
