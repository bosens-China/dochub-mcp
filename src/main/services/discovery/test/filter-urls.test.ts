import { describe, expect, it } from 'vitest'
import { extractLinksFromHtml, filterUrls } from '../index'

describe('filterUrls', () => {
  it('keeps seed in path scope', () => {
    const urls = filterUrls(['https://electron-vite.org/guide/'], '/guide/')
    expect(urls).toEqual(['https://electron-vite.org/guide/'])
  })

  it('extracts sibling links while keeping the broader source scope', () => {
    const urls = extractLinksFromHtml(
      '<a href="./intro">Intro</a><a href="../install">Install</a><a href="/blog/">Blog</a>',
      'https://example.com/docs/guide/start',
      '/docs/'
    )

    expect(urls).toEqual([
      'https://example.com/docs/guide/intro',
      'https://example.com/docs/install'
    ])
  })
})
