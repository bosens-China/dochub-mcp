import { describe, expect, it } from 'vitest'
import type { SyncLogEntry } from '@shared/types'
import {
  docGroupKey,
  formatSyncLogMessage,
  groupLogsByDocument,
  groupLogsBySource,
  SYSTEM_DOC_KEY
} from '@renderer/lib/sync-log'

function entry(partial: Partial<SyncLogEntry> & Pick<SyncLogEntry, 'id' | 'sourceId'>): SyncLogEntry {
  return {
    sourceName: partial.sourceName ?? partial.sourceId,
    action: partial.action ?? 'fetch',
    level: partial.level ?? 'info',
    message: partial.message ?? '抓取',
    timestamp: partial.timestamp ?? '2026-01-01T00:00:00.000Z',
    ...partial
  }
}

describe('sync-log', () => {
  it('formats action messages', () => {
    expect(formatSyncLogMessage({ action: 'skip', reason: 'content_unchanged' })).toBe(
      '跳过：内容未变化'
    )
  })

  it('groups logs by source', () => {
    const logs = [
      entry({ id: '1', sourceId: 'a' }),
      entry({ id: '2', sourceId: 'b' }),
      entry({ id: '3', sourceId: 'a' })
    ]
    const grouped = groupLogsBySource(logs)
    expect(grouped.get('a')).toHaveLength(2)
    expect(grouped.get('b')).toHaveLength(1)
  })

  it('groups logs by document path', () => {
    const logs = [
      entry({ id: '1', sourceId: 'a', path: 'docs/guide/a.md', timestamp: '2026-01-02T00:00:00.000Z' }),
      entry({ id: '2', sourceId: 'a', path: 'docs/guide/b.md' }),
      entry({ id: '3', sourceId: 'a', action: 'domain_halt' })
    ]

    expect(docGroupKey(logs[2]!)).toBe(SYSTEM_DOC_KEY)

    const groups = groupLogsByDocument(logs)
    expect(groups.some((g) => g.key === 'docs/guide/a.md')).toBe(true)
    expect(groups.some((g) => g.key === SYSTEM_DOC_KEY)).toBe(true)
  })
})
