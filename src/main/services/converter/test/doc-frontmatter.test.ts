import { describe, expect, it } from 'vitest'
import { parseDocFile, serializeDocFile, extractDocTitle } from '../doc-frontmatter'

describe('doc frontmatter', () => {
  it('round-trips frontmatter and body', () => {
    const raw = serializeDocFile(
      {
        sourceUrl: 'https://electron-vite.org/guide/',
        originalUrl: 'https://electron-vite.org/guide/',
        title: 'Guide',
        contentHash: 'sha256:abc',
        sourceContentHash: 'sha256:raw',
        language: 'en-US',
        syncedAt: '2026-06-26T10:00:00.000Z'
      },
      'Hello [install](./installation.md)'
    )

    const parsed = parseDocFile(raw)
    expect(parsed?.frontmatter.title).toBe('Guide')
    expect(parsed?.frontmatter.sourceContentHash).toBe('sha256:raw')
    expect(parsed?.frontmatter.language).toBe('en-US')
    expect(parsed?.body).toBe('Hello [install](./installation.md)')
  })

  it('extracts title from frontmatter', () => {
    const raw = serializeDocFile(
      {
        sourceUrl: 'https://example.com/',
        originalUrl: 'https://example.com/',
        title: 'Page Title',
        contentHash: 'sha256:abc',
        syncedAt: '2026-06-26T10:00:00.000Z'
      },
      'Body'
    )
    expect(extractDocTitle(raw, 'fallback')).toBe('Page Title')
    expect(extractDocTitle('no frontmatter', 'fallback')).toBe('fallback')
  })
})
