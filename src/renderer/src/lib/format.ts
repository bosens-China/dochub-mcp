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

export function generateSourceName(url: string): string {
  try {
    const parsed = new URL(url)
    let name = parsed.hostname
    const path = parsed.pathname.replace(/\/$/, '')
    if (path) {
      name += path
    }
    return name
  } catch {
    return url
  }
}

export function calculateMaxDepth(seedUrl: string): number {
  try {
    const url = new URL(seedUrl)
    let pathname = url.pathname
    if (pathname === '/') return 0
    if (pathname.endsWith('/')) pathname = pathname.slice(0, -1)
    const parts = pathname.split('/').filter(Boolean)
    return parts.length
  } catch {
    return 0
  }
}

export function getPrefixByDepth(seedUrl: string, depth: number): string {
  try {
    const url = new URL(seedUrl)
    let pathname = url.pathname
    if (pathname === '/') return '/'

    if (pathname.endsWith('/')) pathname = pathname.slice(0, -1)

    const parts = pathname.split('/').filter(Boolean)
    const keepCount = Math.max(0, parts.length - depth)
    const keptParts = parts.slice(0, keepCount)

    if (keptParts.length === 0) return '/'
    return '/' + keptParts.join('/') + '/'
  } catch {
    return '/'
  }
}

export function getDepthByPrefix(seedUrl: string, pathPrefix: string): number {
  try {
    const url = new URL(seedUrl)
    const urlParts = url.pathname.split('/').filter(Boolean)
    const prefixParts = pathPrefix.split('/').filter(Boolean)
    return Math.max(0, urlParts.length - prefixParts.length)
  } catch {
    return 0
  }
}
