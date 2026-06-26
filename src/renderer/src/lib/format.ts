import type { SyncStatus } from '@shared/types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '从未同步'
  return dayjs(iso).fromNow()
}

export function formatDateTime(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD HH:mm:ss')
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: '待同步',
  syncing: '同步中',
  paused: '已暂停',
  failed: '同步失败',
  completed: '已同步',
  domain_halted: '域名熔断'
}

const STATUS_COLOR: Record<SyncStatus, string> = {
  idle: 'default',
  syncing: 'processing',
  paused: 'warning',
  failed: 'error',
  completed: 'success',
  domain_halted: 'error'
}

export function syncStatusLabel(status: SyncStatus): string {
  return STATUS_LABEL[status]
}

export function syncStatusColor(status: SyncStatus): string {
  return STATUS_COLOR[status]
}

export function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url
  return `${url.slice(0, max - 1)}…`
}
