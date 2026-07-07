import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '@shared/types/config'
import type { SourceRecord, SyncProgress } from '@shared/types'
import { parseAppConfig } from '@shared/types/config'
import { createSourceRecord } from '../../source/store'
import { computeNextRunAt, scheduleIntervalMs, SyncScheduler } from '../sync-scheduler'

function makeRecord(nextRunAt: string | null): SourceRecord {
  const record = createSourceRecord({
    name: 'Scheduled Docs',
    seedUrl: 'https://example.com/docs/',
    crawlMode: 'ssr'
  })
  return {
    ...record,
    schedule: {
      enabled: true,
      interval: 1,
      unit: 'day',
      nextRunAt
    }
  }
}

function activeProgress(sourceId: string): SyncProgress {
  return {
    sourceId,
    phase: 'crawling',
    message: 'running',
    total: 1,
    completed: 0,
    failed: 0,
    currentUrl: null
  }
}

describe('SyncScheduler', () => {
  let config: AppConfig

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T00:00:00.000Z'))
    config = parseAppConfig({ dataDir: 'C:/tmp/dochub-scheduler-test' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers due sources and writes the next run time', async () => {
    let record = makeRecord('2026-07-06T00:00:00.000Z')
    const runSync = vi.fn(async () => undefined)
    const scheduler = new SyncScheduler({
      listRecords: async () => [record],
      writeRecord: async (next) => {
        record = next
      },
      runSync,
      getProgress: () => null,
      onError: vi.fn()
    })

    await scheduler.refresh(config)
    scheduler.stop()

    expect(runSync).toHaveBeenCalledWith(record.id, config)
    expect(record.schedule.nextRunAt).toBe('2026-07-08T00:00:00.000Z')
  })

  it('does not start another sync when the source is already active', async () => {
    let record = makeRecord('2026-07-06T00:00:00.000Z')
    const runSync = vi.fn(async () => undefined)
    const scheduler = new SyncScheduler({
      listRecords: async () => [record],
      writeRecord: async (next) => {
        record = next
      },
      runSync,
      getProgress: (sourceId) => activeProgress(sourceId),
      onError: vi.fn()
    })

    await scheduler.refresh(config)
    scheduler.stop()

    expect(runSync).not.toHaveBeenCalled()
    expect(record.schedule.nextRunAt).toBe('2026-07-07T00:01:00.000Z')
  })
})

describe('scheduleIntervalMs', () => {
  it('uses fixed intervals for hour/day/week/month', () => {
    const base = makeRecord(null).schedule
    expect(scheduleIntervalMs({ ...base, interval: 2, unit: 'hour' })).toBe(2 * 60 * 60 * 1000)
    expect(scheduleIntervalMs({ ...base, interval: 2, unit: 'day' })).toBe(2 * 24 * 60 * 60 * 1000)
    expect(scheduleIntervalMs({ ...base, interval: 2, unit: 'week' })).toBe(
      14 * 24 * 60 * 60 * 1000
    )
    expect(
      computeNextRunAt(Date.parse('2026-07-07T00:00:00.000Z'), { ...base, unit: 'month' })
    ).toBe('2026-08-06T00:00:00.000Z')
  })
})
