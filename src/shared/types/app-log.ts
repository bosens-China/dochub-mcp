/** Application-wide log level (distinct from sync-log's action-derived level). */
export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error'

/** One on-disk / in-memory application log record (see main/services/logger). */
export interface AppLogEntry {
  /** Stable id for React keys: `${ts}-${seq}`. */
  id: string
  /** ISO timestamp. */
  ts: string
  level: AppLogLevel
  /** Subsystem tag, e.g. 'mcp', 'sync', 'app'. */
  scope: string
  message: string
  /** Optional structured detail, JSON-serializable. */
  meta?: Record<string, unknown>
}
