import type { AppConfig } from '@shared/types/config'
import type { SourceRecord, SourceSchedule, SyncProgress } from '@shared/types'
import { listSourceRecords, writeSourceRecord } from '../source/store'
import { getSyncProgress, runSourceSync } from '../sync/runner'
import { logger } from '../logger/app-logger'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const MAX_TIMER_DELAY_MS = 24 * HOUR_MS

export interface SyncSchedulerDeps {
  listRecords(config: AppConfig): Promise<SourceRecord[]>
  writeRecord(record: SourceRecord, config: AppConfig): Promise<void>
  runSync(sourceId: string, config: AppConfig): Promise<void>
  getProgress(sourceId: string): SyncProgress | null
  onError(scope: string, message: string, meta?: Record<string, unknown>): void
}

const defaultDeps: SyncSchedulerDeps = {
  listRecords: listSourceRecords,
  writeRecord: writeSourceRecord,
  runSync: runSourceSync,
  getProgress: getSyncProgress,
  onError: (scope, message, meta) => logger.error(scope, message, meta)
}

function parseTime(value: string | null): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

export function scheduleIntervalMs(schedule: SourceSchedule): number {
  const interval = Math.max(1, schedule.interval)
  if (schedule.unit === 'hour') return interval * HOUR_MS
  if (schedule.unit === 'week') return interval * 7 * DAY_MS
  if (schedule.unit === 'month') return interval * 30 * DAY_MS
  return interval * DAY_MS
}

export function computeNextRunAt(anchorTimeMs: number, schedule: SourceSchedule): string {
  return new Date(anchorTimeMs + scheduleIntervalMs(schedule)).toISOString()
}

function nextRunTime(record: SourceRecord, now: number): number {
  const stored = parseTime(record.schedule.nextRunAt)
  if (stored !== null) return stored

  const anchor =
    parseTime(record.sync.lastSyncAt) ??
    parseTime(record.updatedAt) ??
    parseTime(record.createdAt) ??
    now
  return anchor + scheduleIntervalMs(record.schedule)
}

function withNextRunAt(record: SourceRecord, nextRunAt: string | null): SourceRecord {
  return {
    ...record,
    schedule: {
      ...record.schedule,
      nextRunAt
    },
    updatedAt: new Date().toISOString()
  }
}

export class SyncScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private config: AppConfig | null = null
  private refreshing = false

  constructor(private readonly deps: SyncSchedulerDeps = defaultDeps) {}

  start(config: AppConfig): void {
    this.config = config
    void this.refresh(config)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.config = null
  }

  async refresh(config: AppConfig | null = this.config): Promise<void> {
    if (!config || this.refreshing) return
    this.config = config
    this.refreshing = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    try {
      const records = await this.deps.listRecords(config)
      const now = Date.now()
      const due: SourceRecord[] = []
      let nearest: number | null = null

      for (const record of records) {
        if (!record.schedule.enabled) continue
        const next = nextRunTime(record, now)
        if (!record.schedule.nextRunAt) {
          await this.deps.writeRecord(withNextRunAt(record, new Date(next).toISOString()), config)
        }
        if (next <= now) {
          due.push(record)
        } else {
          nearest = nearest === null ? next : Math.min(nearest, next)
        }
      }

      const dueNearest = due.length > 0 ? await this.triggerDue(due, config, now) : null
      const nextTime =
        nearest === null
          ? dueNearest
          : dueNearest === null
            ? nearest
            : Math.min(nearest, dueNearest)
      this.scheduleNext(nextTime)
    } catch (err) {
      this.deps.onError('scheduler', '定时同步调度刷新失败', {
        error: err instanceof Error ? err.message : String(err)
      })
      this.scheduleNext(Date.now() + MINUTE_MS)
    } finally {
      this.refreshing = false
    }
  }

  private scheduleNext(nextTime: number | null): void {
    if (!this.config || nextTime === null) return
    const delay = Math.max(1_000, Math.min(MAX_TIMER_DELAY_MS, nextTime - Date.now()))
    this.timer = setTimeout(() => {
      void this.refresh()
    }, delay)
  }

  private async triggerDue(
    records: SourceRecord[],
    config: AppConfig,
    now: number
  ): Promise<number | null> {
    let nearest: number | null = null
    for (const record of records) {
      if (this.deps.getProgress(record.id)) {
        const next = now + MINUTE_MS
        await this.deps.writeRecord(withNextRunAt(record, new Date(next).toISOString()), config)
        nearest = nearest === null ? next : Math.min(nearest, next)
        continue
      }

      const nextRunAt = computeNextRunAt(now, record.schedule)
      const next = parseTime(nextRunAt) ?? now + scheduleIntervalMs(record.schedule)
      await this.deps.writeRecord(withNextRunAt(record, nextRunAt), config)
      nearest = nearest === null ? next : Math.min(nearest, next)
      void this.deps
        .runSync(record.id, config)
        .catch((err) => {
          this.deps.onError('scheduler', `定时同步失败: ${record.id}`, {
            error: err instanceof Error ? err.message : String(err)
          })
        })
        .finally(() => {
          void this.refresh(config)
        })
    }
    return nearest
  }
}

const scheduler = new SyncScheduler()

export function startSyncScheduler(config: AppConfig): void {
  scheduler.start(config)
}

export function stopSyncScheduler(): void {
  scheduler.stop()
}

export function refreshSyncScheduler(config?: AppConfig): Promise<void> {
  return scheduler.refresh(config ?? null)
}
