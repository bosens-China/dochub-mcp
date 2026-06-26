import { describe, expect, it } from 'vitest'
import { buildUrlToPathIndex, localizeMarkdownLinks, relativeDocLink } from '../link-localizer'

describe('relativeDocLink', () => {
  it('links within the same directory', () => {
    expect(relativeDocLink('docs/guide/index.md', 'docs/guide/installation.md')).toBe(
      './installation.md'
    )
  })

  it('links across directories', () => {
    expect(relativeDocLink('docs/guide/index.md', 'docs/config/index.md')).toBe(
      '../config/index.md'
    )
  })
})

describe('localizeMarkdownLinks', () => {
  const urlToPath = buildUrlToPathIndex({
    'https://electron-vite.org/guide/': { path: 'docs/index.md' },
    'https://electron-vite.org/guide/installation.html': { path: 'docs/installation.md' }
  })

  it('rewrites in-scope links to relative paths', () => {
    const body = 'See [install](https://electron-vite.org/guide/installation.html).'
    const localized = localizeMarkdownLinks(body, {
      currentDocPath: 'docs/index.md',
      scopePrefix: '/guide/',
      origin: 'https://electron-vite.org',
      urlToPath
    })
    expect(localized).toBe('See [install](./installation.md).')
  })

  it('preserves external links', () => {
    const body = 'Visit [GitHub](https://github.com/electron-vite/electron-vite).'
    const localized = localizeMarkdownLinks(body, {
      currentDocPath: 'docs/index.md',
      scopePrefix: '/guide/',
      origin: 'https://electron-vite.org',
      urlToPath
    })
    expect(localized).toBe(body)
  })

  it('preserves hash fragments', () => {
    const body = '[section](https://electron-vite.org/guide/installation.html#setup)'
    const localized = localizeMarkdownLinks(body, {
      currentDocPath: 'docs/index.md',
      scopePrefix: '/guide/',
      origin: 'https://electron-vite.org',
      urlToPath
    })
    expect(localized).toBe('[section](./installation.md#setup)')
  })
})
