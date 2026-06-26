import { useMemo, useState } from 'react'
import { Badge, Empty, Tabs, Timeline } from 'antd'
import {
  CloseCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import type { DocSource, SyncLogEntry, SyncLogLevel } from '@shared/types'
import { formatDateTime } from '@renderer/lib/format'
import {
  docGroupLabel,
  formatSyncLogMessage,
  groupLogsByDocument,
  groupLogsBySource
} from '@renderer/lib/sync-log'

const LOG_ICON: Record<SyncLogLevel, React.ReactNode> = {
  info: <InfoCircleOutlined className="text-archive-teal" />,
  warn: <WarningOutlined className="text-archive-signal" />,
  error: <CloseCircleOutlined className="text-archive-danger" />
}

function LogTimeline({
  logs,
  showPath = true
}: {
  logs: SyncLogEntry[]
  showPath?: boolean
}): React.JSX.Element {
  if (logs.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="该分类下暂无记录"
        className="my-8"
      />
    )
  }

  return (
    <Timeline
      className="mt-4"
      items={logs.map((log) => ({
        icon: LOG_ICON[log.level],
        content: (
          <div className="pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <time className="text-xs text-archive-muted font-mono">
                {formatDateTime(log.timestamp)}
              </time>
              {showPath && log.path && (
                <span className="font-mono text-xs text-archive-teal truncate max-w-full">
                  {docGroupLabel(log.path)}
                </span>
              )}
            </div>
            <p className="text-sm text-archive-ink m-0 mt-1">
              {log.message || formatSyncLogMessage(log)}
            </p>
            {log.url && (
              <p className="font-mono text-xs text-archive-muted m-0 mt-1 truncate">{log.url}</p>
            )}
          </div>
        )
      }))}
    />
  )
}

function SourceLogPanel({ logs }: { logs: SyncLogEntry[] }): React.JSX.Element {
  const [docTab, setDocTab] = useState('__all__')
  const docGroups = useMemo(() => groupLogsByDocument(logs), [logs])

  const docTabItems = useMemo(
    () => [
      {
        key: '__all__',
        label: (
          <span>
            全部
            <Badge count={logs.length} size="small" className="ml-2" color="#0f766e" />
          </span>
        ),
        children: <LogTimeline logs={logs} showPath />
      },
      ...docGroups.map((group) => ({
        key: group.key,
        label: (
          <span className="font-mono text-xs max-w-40 truncate inline-block align-bottom">
            {group.label}
            <Badge count={group.logs.length} size="small" className="ml-2" color="#64748b" />
          </span>
        ),
        children: <LogTimeline logs={group.logs} showPath={false} />
      }))
    ],
    [docGroups, logs]
  )

  return (
    <Tabs
      size="small"
      type="card"
      activeKey={docTab}
      onChange={setDocTab}
      items={docTabItems}
      className="sync-doc-tabs"
    />
  )
}

interface SyncLogTabsProps {
  logs: SyncLogEntry[]
  sources: DocSource[]
  isLoading: boolean
}

export function SyncLogTabs({ logs, sources, isLoading }: SyncLogTabsProps): React.JSX.Element {
  const [sourceTab, setSourceTab] = useState<string | undefined>(undefined)

  const logsBySource = useMemo(() => groupLogsBySource(logs), [logs])

  const sourceTabItems = useMemo(() => {
    const sourceIds = new Set<string>([
      ...sources.map((s) => s.id),
      ...logs.map((l) => l.sourceId)
    ])

    return [...sourceIds]
      .map((sourceId) => {
        const source = sources.find((s) => s.id === sourceId)
        const sourceLogs = logsBySource.get(sourceId) ?? []
        return {
          sourceId,
          name: source?.name ?? sourceId,
          count: sourceLogs.length,
          logs: sourceLogs
        }
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        key: item.sourceId,
        label: (
          <span>
            {item.name}
            {item.count > 0 && (
              <Badge count={item.count} size="small" className="ml-2" color="#0f766e" />
            )}
          </span>
        ),
        children: <SourceLogPanel logs={item.logs} />
      }))
  }, [logs, logsBySource, sources])

  const activeKey = sourceTab ?? sourceTabItems[0]?.key

  if (isLoading) {
    return <p className="text-archive-muted">加载日志…</p>
  }

  if (sourceTabItems.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="还没有同步日志，添加文档源并开始同步后会出现在这里"
        className="my-8"
      />
    )
  }

  return (
    <Tabs
      activeKey={activeKey}
      onChange={setSourceTab}
      items={sourceTabItems}
      className="sync-source-tabs"
    />
  )
}
