import { appendFile, mkdir, readFile, stat } from 'fs/promises'
import { dirname } from 'path'
import { existsSync } from 'fs'
import type { AppConfig } from '@shared/types/config'
import type { AppLogEntry, AppLogLevel } from '@shared/types'
import { getAppLogPath } from '../../config/paths'

/**
 * App-wide logger: appends JSONL to `{dataDir}/app.log.jsonl`, mirrors to the
 * console, and can be tail-read by the renderer. Distinct from the sync log
 * (which is keyed by sourceId + crawl action); this is for lifecycle / MCP /
 * unexpected-error diagnostics.
 */

interface LogRecord {
  ts: string
  level: AppLogLevel
  scope: string
  message: string
  meta?: Record<string, unknown>
}

let logPath: string | null = null
let writeChain: Promise<void> = Promise.resolve()
let seq = 0

/** Point the logger at the active data dir. Call at startup and on data-dir change. */
export function setLoggerConfig(config: AppConfig): void {
  logPath = getAppLogPath(config)
}

const CONSOLE_METHOD: Record<AppLogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error'
}

function toConsole(record: LogRecord): void {
  const prefix = `[${record.scope}]`
  const method = CONSOLE_METHOD[record.level]
  if (record.meta) {
    console[method](prefix, record.message, record.meta)
  } else {
    console[method](prefix, record.message)
  }
}

function appendToDisk(record: LogRecord): void {
  if (!logPath) return
  const target = logPath
  const line = `${JSON.stringify(record)}\n`
  writeChain = writeChain
    .then(async () => {
      if (!existsSync(dirname(target))) {
        await mkdir(dirname(target), { recursive: true })
      }
      await appendFile(target, line, 'utf8')
    })
    .catch((err) => {
      // Never let logging crash the app; surface once on the console.
      console.error('[logger] 写入日志失败', err)
    })
}

export function appLog(
  level: AppLogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  const record: LogRecord = { ts: new Date().toISOString(), level, scope, message }
  if (meta && Object.keys(meta).length > 0) record.meta = meta
  toConsole(record)
  appendToDisk(record)
}

export const logger = {
  debug: (scope: string, message: string, meta?: Record<string, unknown>) =>
    appLog('debug', scope, message, meta),
  info: (scope: string, message: string, meta?: Record<string, unknown>) =>
    appLog('info', scope, message, meta),
  warn: (scope: string, message: string, meta?: Record<string, unknown>) =>
    appLog('warn', scope, message, meta),
  error: (scope: string, message: string, meta?: Record<string, unknown>) =>
    appLog('error', scope, message, meta)
}

/**
 * Tail-read the most recent app-log entries (newest first). Reads only the tail
 * of the file to stay cheap even when the log grows large.
 */
export async function readAppLogs(config: AppConfig, limit = 200): Promise<AppLogEntry[]> {
  const path = getAppLogPath(config)
  if (!existsSync(path)) return []

  const { size } = await stat(path)
  const tailBytes = Math.min(size, limit * 600)
  const buf = await readFile(path)
  const slice = buf.subarray(size - tailBytes).toString('utf8')
  const lines = slice.split('\n').filter((l) => l.trim().length > 0)
  // Drop a possibly-truncated first line when we didn't read from the top.
  if (tailBytes < size && lines.length > 0) lines.shift()

  const entries: AppLogEntry[] = []
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as LogRecord
      entries.push({
        id: `${rec.ts}-${seq++}`,
        ts: rec.ts,
        level: rec.level,
        scope: rec.scope,
        message: rec.message,
        meta: rec.meta
      })
    } catch {
      // skip unparseable line
    }
  }
  return entries.slice(-limit).reverse()
}
