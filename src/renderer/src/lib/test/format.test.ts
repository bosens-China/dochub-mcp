import { describe, expect, it } from 'vitest'
import { syncStatusLabel, truncateUrl } from '@renderer/lib/format'

describe('format', () => {
  it('truncates long urls', () => {
    const url = 'https://example.com/very/long/path/that/exceeds/the/limit'
    expect(truncateUrl(url, 32).endsWith('…')).toBe(true)
  })

  it('maps sync status to label', () => {
    expect(syncStatusLabel('syncing')).toBe('同步中')
  })
})
