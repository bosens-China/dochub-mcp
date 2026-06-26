import { describe, expect, it } from 'vitest'
import { parseDocFile, serializeDocFile } from '../doc-frontmatter'

describe('doc frontmatter', () => {
  it('round-trips frontmatter and body', () => {
    const raw = serializeDocFile(
      {
        sourceUrl: 'https://electron-vite.org/guide/',
        originalUrl: 'https://electron-vite.org/guide/',
        title: 'Guide',
        contentHash: 'sha256:abc',
        syncedAt: '2026-06-26T10:00:00.000Z'
      },
      'Hello [install](./installation.md)'
    )

    const parsed = parseDocFile(raw)
    expect(parsed?.frontmatter.title).toBe('Guide')
    expect(parsed?.body).toBe('Hello [install](./installation.md)')
  })
})
