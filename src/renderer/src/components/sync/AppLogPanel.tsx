import { Empty, Tag, Timeline } from 'antd'
import {
  BugOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import type { AppLogEntry, AppLogLevel } from '@shared/types'
import { formatDateTime } from '@renderer/lib/format'

const LEVEL_ICON: Record<AppLogLevel, React.ReactNode> = {
  debug: <BugOutlined className="text-archive-muted" />,
  info: <InfoCircleOutlined className="text-archive-teal" />,
  warn: <WarningOutlined className="text-archive-signal" />,
  error: <CloseCircleOutlined className="text-archive-danger" />
}

const LEVEL_COLOR: Record<AppLogLevel, string> = {
  debug: 'default',
  info: 'cyan',
  warn: 'gold',
  error: 'red'
}

export function AppLogPanel({
  logs,
  isLoading
}: {
  logs: AppLogEntry[]
  isLoading: boolean
}): React.JSX.Element {
  if (isLoading) {
    return <p className="text-archive-muted">加载日志…</p>
  }
  if (logs.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无应用日志" className="my-8" />
    )
  }

  return (
    <Timeline
      className="mt-4"
      items={logs.map((log) => ({
        icon: LEVEL_ICON[log.level],
        content: (
          <div className="pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <time className="text-xs text-archive-muted font-mono">{formatDateTime(log.ts)}</time>
              <Tag color={LEVEL_COLOR[log.level]} className="m-0">
                {log.scope}
              </Tag>
            </div>
            <p className="text-sm text-archive-ink m-0 mt-1">{log.message}</p>
            {log.meta && (
              <pre className="font-mono text-xs text-archive-muted m-0 mt-1 whitespace-pre-wrap break-all">
                {JSON.stringify(log.meta)}
              </pre>
            )}
          </div>
        )
      }))}
    />
  )
}
