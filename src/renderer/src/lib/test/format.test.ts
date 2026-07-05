import { describe, expect, it } from 'vitest'
import {
  syncStatusLabel,
  truncateUrl,
  generateSourceName,
  calculateMaxDepth,
  getPrefixByDepth
} from '@renderer/lib/format'

describe('format', () => {
  it('truncates long urls', () => {
    const url = 'https://example.com/very/long/path/that/exceeds/the/limit'
    expect(truncateUrl(url, 32).endsWith('…')).toBe(true)
  })

  it('maps sync status to label', () => {
    expect(syncStatusLabel('syncing')).toBe('同步中')
  })

  it('generates source name from url', () => {
    expect(generateSourceName('https://docs.langchain.com')).toBe('docs.langchain.com')
    expect(generateSourceName('https://docs.langchain.com/')).toBe('docs.langchain.com')
    expect(generateSourceName('https://docs.langchain.com/oss/')).toBe('docs.langchain.com/oss')
    expect(generateSourceName('https://example.com/a/b/c')).toBe('example.com/a/b/c')
    expect(generateSourceName('invalid-url')).toBe('invalid-url')
  })

  it('calculates max depth correctly', () => {
    expect(calculateMaxDepth('https://example.com/')).toBe(0)
    expect(calculateMaxDepth('https://example.com/a')).toBe(1)
    expect(calculateMaxDepth('https://example.com/a/')).toBe(1)
    expect(calculateMaxDepth('https://example.com/a/b/c')).toBe(3)
    expect(calculateMaxDepth('invalid')).toBe(0)
  })

  it('gets prefix by depth correctly', () => {
    const url = 'https://docs.langchain.com/oss/python/langchain/overview'
    expect(getPrefixByDepth(url, 0)).toBe('/oss/python/langchain/overview/')
    expect(getPrefixByDepth(url, 1)).toBe('/oss/python/langchain/')
    expect(getPrefixByDepth(url, 2)).toBe('/oss/python/')
    expect(getPrefixByDepth(url, 3)).toBe('/oss/')
    expect(getPrefixByDepth(url, 4)).toBe('/')
    expect(getPrefixByDepth(url, 5)).toBe('/') // handles out of bounds

    const folderUrl = 'https://docs.langchain.com/oss/python/'
    expect(getPrefixByDepth(folderUrl, 0)).toBe('/oss/python/')
    expect(getPrefixByDepth(folderUrl, 1)).toBe('/oss/')
    expect(getPrefixByDepth(folderUrl, 2)).toBe('/')
  })
})
