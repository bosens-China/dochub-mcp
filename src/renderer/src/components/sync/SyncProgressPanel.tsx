import { Progress, Tag } from 'antd'
import { CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { DocSource, SyncProgress } from '@shared/types'

interface SyncProgressPanelProps {
  progressList: SyncProgress[]
  sources: DocSource[]
}

export function SyncProgressPanel({
  progressList,
  sources
}: SyncProgressPanelProps): React.JSX.Element {
  const hasActiveSync = progressList.length > 0
  const primaryProgress = progressList[0]
  const activeSource = primaryProgress
    ? sources.find((s) => s.id === primaryProgress.sourceId)
    : undefined

  const percent = primaryProgress
    ? Math.round((primaryProgress.completed / Math.max(primaryProgress.total, 1)) * 100)
    : 0

  return (
    <section className="archive-panel p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="archive-label m-0">当前任务</p>
          {hasActiveSync && activeSource ? (
            <h2 className="font-display text-lg m-0 mt-1 text-archive-ink">
              {activeSource.name}
              {progressList.length > 1 && (
                <span className="text-sm text-archive-muted font-body font-normal ml-2">
                  等 {progressList.length} 个任务
                </span>
              )}
            </h2>
          ) : (
            <p className="text-archive-muted m-0 mt-1 flex items-center gap-2">
              <CheckCircleOutlined className="text-archive-teal" />
              没有进行中的同步
            </p>
          )}
        </div>
        {hasActiveSync && (
          <Tag color="processing" icon={<InfoCircleOutlined spin />}>
            同步中
          </Tag>
        )}
      </div>

      {hasActiveSync && primaryProgress && (
        <>
          <Progress
            percent={percent}
            strokeColor="#0f766e"
            format={() => `${primaryProgress.completed}/${primaryProgress.total}`}
          />
          <p className="text-sm text-archive-ink mt-3 mb-0">{primaryProgress.message}</p>
          {primaryProgress.currentUrl && (
            <p className="font-mono text-xs text-archive-muted mt-2 mb-0 truncate">
              {primaryProgress.currentUrl}
            </p>
          )}
          {primaryProgress.failed > 0 && (
            <p className="text-archive-danger text-sm mt-2 mb-0">
              {primaryProgress.failed} 个 URL 失败
            </p>
          )}
        </>
      )}

      {progressList.length > 1 && (
        <ul className="mt-4 mb-0 pl-0 list-none space-y-2">
          {progressList.slice(1).map((item) => {
            const source = sources.find((s) => s.id === item.sourceId)
            return (
              <li key={item.sourceId} className="text-sm border-t border-archive-line pt-2">
                <span className="font-medium text-archive-ink">{source?.name ?? item.sourceId}</span>
                <span className="text-archive-muted ml-2">{item.message}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
