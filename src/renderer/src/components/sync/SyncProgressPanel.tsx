import { App, Button, Progress, Tag } from 'antd'
import { CheckCircleOutlined, InfoCircleOutlined, PauseOutlined } from '@ant-design/icons'
import type { DocSource, SyncProgress } from '@shared/types'
import { usePauseSync } from '@renderer/hooks/use-app-data'

interface SyncProgressPanelProps {
  progressList: SyncProgress[]
  sources: DocSource[]
}

export function SyncProgressPanel({
  progressList,
  sources
}: SyncProgressPanelProps): React.JSX.Element {
  const { message } = App.useApp()
  const pauseMutation = usePauseSync()
  const hasActiveSync = progressList.length > 0
  const primaryProgress = progressList[0]
  const activeSource = primaryProgress
    ? sources.find((s) => s.id === primaryProgress.sourceId)
    : undefined

  const percent = primaryProgress
    ? Math.round((primaryProgress.completed / Math.max(primaryProgress.total, 1)) * 100)
    : 0
  const canPausePrimary = primaryProgress?.phase !== 'finalizing'

  const queueText = (item: SyncProgress): string => {
    const remaining = Math.max(item.total - item.completed, 0)
    return `已抓取 ${item.completed} 页 · 队列约 ${remaining} 页${
      item.failed > 0 ? ` · 失败 ${item.failed}` : ''
    }`
  }

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
        {hasActiveSync && primaryProgress && (
          <div className="flex items-center gap-2">
            <Tag color="processing" icon={<InfoCircleOutlined spin />} className="m-0">
              同步中
            </Tag>
            <Button
              size="small"
              icon={<PauseOutlined />}
              loading={pauseMutation.isPending}
              disabled={!canPausePrimary}
              onClick={() =>
                pauseMutation.mutate(primaryProgress.sourceId, {
                  onError: (err) => {
                    message.error(err instanceof Error ? err.message : '暂停失败')
                  }
                })
              }
            >
              {canPausePrimary ? '暂停' : '收尾中'}
            </Button>
          </div>
        )}
      </div>

      {hasActiveSync && primaryProgress && (
        <>
          <Progress percent={percent} strokeColor="#0f766e" showInfo={false} />
          <p className="text-sm text-archive-ink mt-3 mb-0">{primaryProgress.message}</p>
          <p className="text-xs text-archive-muted mt-1 mb-0">{queueText(primaryProgress)}</p>
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
        <ul className="mt-4 mb-0 pl-0 list-none space-y-3">
          {progressList.slice(1).map((item) => {
            const source = sources.find((s) => s.id === item.sourceId)
            const itemPercent = Math.round((item.completed / Math.max(item.total, 1)) * 100)
            return (
              <li key={item.sourceId} className="text-sm border-t border-archive-line pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-archive-ink truncate">
                    {source?.name ?? item.sourceId}
                  </span>
                  <span className="text-xs text-archive-muted shrink-0">{queueText(item)}</span>
                </div>
                <Progress
                  className="mt-1"
                  percent={itemPercent}
                  strokeColor="#0f766e"
                  showInfo={false}
                  size="small"
                />
                <p className="text-xs text-archive-muted mt-1 mb-0 truncate">{item.message}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
