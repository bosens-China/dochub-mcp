import { describe, expect, it } from 'vitest'
import { isInScope, urlToDocPath } from '../util'

describe('isInScope', () => {
  it('matches path-only prefix on same site', () => {
    expect(isInScope('https://electron-vite.org/guide/', '/guide/')).toBe(true)
    expect(isInScope('https://electron-vite.org/guide/getting-started', '/guide/')).toBe(true)
    expect(isInScope('https://electron-vite.org/blog/', '/guide/')).toBe(false)
  })
})

describe('urlToDocPath', () => {
  it('maps guide index with path-only prefix', () => {
    expect(urlToDocPath('https://electron-vite.org/guide/', '/guide/')).toBe('docs/index.md')
  })
})
