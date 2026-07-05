import type { SyncLogAction, SyncLogEntry, SyncLogLevel } from '@shared/types'

const ACTION_LABEL: Record<SyncLogAction, string> = {
  fetch: '抓取',
  update: '更新',
  skip: '跳过',
  delete: '删除',
  fail: '失败',
  domain_halt: '域名熔断',
  pause: '暂停'
}

const REASON_LABEL: Record<string, string> = {
  content_unchanged: '内容未变化',
  removed_from_site: '远端已移除',
  domain_failure_threshold: '失败 URL 达到阈值',
  user_paused: '用户暂停'
}

export const SYSTEM_DOC_KEY = '__system__'
export const OTHER_DOC_KEY = '__other__'
export const MAX_DOC_TABS = 24

export function syncLogLevel(entry: Pick<SyncLogEntry, 'action'>): SyncLogLevel {
  if (entry.action === 'fail' || entry.action === 'domain_halt') return 'error'
  if (entry.action === 'delete' || entry.action === 'pause') return 'warn'
  return 'info'
}

export function formatSyncLogMessage(
  entry: Pick<SyncLogEntry, 'action' | 'reason' | 'url'>
): string {
  const label = ACTION_LABEL[entry.action]
  if (entry.reason) {
    const reasonText = REASON_LABEL[entry.reason] ?? entry.reason
    return `${label}：${reasonText}`
  }
  return label
}

export function docGroupKey(entry: Pick<SyncLogEntry, 'path' | 'url'>): string {
  return entry.path ?? entry.url ?? SYSTEM_DOC_KEY
}

export function docGroupLabel(key: string): string {
  if (key === SYSTEM_DOC_KEY) return '系统事件'
  if (key === OTHER_DOC_KEY) return '其他页面'
  return key.replace(/^docs\//, '')
}

export function groupLogsBySource(logs: SyncLogEntry[]): Map<string, SyncLogEntry[]> {
  const map = new Map<string, SyncLogEntry[]>()
  for (const log of logs) {
    const list = map.get(log.sourceId) ?? []
    list.push(log)
    map.set(log.sourceId, list)
  }
  return map
}

export interface DocLogGroup {
  key: string
  label: string
  logs: SyncLogEntry[]
  latestTs: string
}

export function groupLogsByDocument(logs: SyncLogEntry[]): DocLogGroup[] {
  const map = new Map<string, SyncLogEntry[]>()

  for (const log of logs) {
    const key = docGroupKey(log)
    const list = map.get(key) ?? []
    list.push(log)
    map.set(key, list)
  }

  const groups: DocLogGroup[] = [...map.entries()].map(([key, items]) => ({
    key,
    label: docGroupLabel(key),
    logs: items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    latestTs: items.reduce(
      (max, item) => (item.timestamp > max ? item.timestamp : max),
      items[0]?.timestamp ?? ''
    )
  }))

  groups.sort((a, b) => {
    if (a.key === SYSTEM_DOC_KEY) return 1
    if (b.key === SYSTEM_DOC_KEY) return -1
    return b.latestTs.localeCompare(a.latestTs)
  })

  if (groups.length <= MAX_DOC_TABS + 1) {
    return groups
  }

  const system = groups.find((g) => g.key === SYSTEM_DOC_KEY)
  const docs = groups.filter((g) => g.key !== SYSTEM_DOC_KEY)
  const visible = docs.slice(0, MAX_DOC_TABS)
  const hidden = docs.slice(MAX_DOC_TABS)

  if (hidden.length === 0) {
    return system ? [...visible, system] : visible
  }

  const otherLogs = hidden
    .flatMap((g) => g.logs)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const otherGroup: DocLogGroup = {
    key: OTHER_DOC_KEY,
    label: docGroupLabel(OTHER_DOC_KEY),
    logs: otherLogs,
    latestTs: otherLogs[0]?.timestamp ?? ''
  }

  const result = [...visible, otherGroup]
  if (system) result.push(system)
  return result
}
