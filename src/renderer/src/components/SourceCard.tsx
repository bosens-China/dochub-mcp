import {
  DeleteOutlined,
  EditOutlined,
  PauseOutlined,
  CalendarOutlined,
  LinkOutlined,
  ReadOutlined,
  SyncOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { App, Button, Progress, Tag, Tooltip } from 'antd'
import { useRouter } from '@tanstack/react-router'
import type { DocSource } from '@shared/types'
import {
  formatRelativeTime,
  syncStatusColor,
  syncStatusLabel,
  truncateUrl
} from '@renderer/lib/format'
import {
  useDeleteSource,
  usePauseSync,
  useSourceSyncProgress,
  useTriggerSync
} from '@renderer/hooks/use-app-data'
import { crawlModeName } from '@renderer/lib/crawl-mode'

interface SourceCardProps {
  source: DocSource
  onEdit: (id: string) => void
}

export function SourceCard({ source, onEdit }: SourceCardProps): React.JSX.Element {
  const { message, modal } = App.useApp()
  const router = useRouter()
  const syncMutation = useTriggerSync()
  const pauseMutation = usePauseSync()
  const deleteMutation = useDeleteSource()
  const progress = useSourceSyncProgress(source.id)
  const isSyncing = source.status === 'syncing' || progress !== null
  const isPaused = source.status === 'paused'
  const canPause = progress?.phase !== 'finalizing'

  const handleBrowse = (): void => {
    void router.navigate({ to: '/browse', search: { sourceId: source.id, path: undefined } })
  }

  const handleDelete = (): void => {
    modal.confirm({
      title: '删除文档源',
      content: `确定删除「${source.name}」？本地镜像文件将一并移除。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteMutation.mutateAsync(source.id)
    })
  }

  return (
    <article className="archive-panel p-0 flex overflow-hidden hover:shadow-md transition-shadow">
      <div
        className="archive-spine w-2 self-stretch shrink-0"
        style={{ backgroundColor: source.spineColor }}
        aria-hidden
      />
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              className="text-left w-full bg-transparent border-0 p-0 cursor-pointer group/title"
              onClick={handleBrowse}
              title="浏览文档"
            >
              <h3 className="font-display text-lg text-archive-ink m-0 font-semibold group-hover/title:text-archive-teal transition-colors">
                {source.name}
              </h3>
            </button>
            <p className="font-mono text-xs text-archive-muted mt-1 mb-0 truncate">
              <LinkOutlined className="mr-1" />
              {truncateUrl(source.seedUrl, 56)}
            </p>
          </div>
          <Tag color={syncStatusColor(isSyncing ? 'syncing' : source.status)}>
            {isSyncing ? '同步中' : syncStatusLabel(source.status)}
          </Tag>
        </div>

        {progress && (
          <div className="mt-3">
            <Progress
              percent={Math.round((progress.completed / Math.max(progress.total, 1)) * 100)}
              size="small"
              strokeColor="#0f766e"
              showInfo={false}
            />
            <p className="text-xs text-archive-ink m-0 mt-1.5">{progress.message}</p>
            <p className="text-xs text-archive-muted m-0 mt-0.5">
              已抓取 {progress.completed} 页 · 队列约{' '}
              {Math.max(progress.total - progress.completed, 0)} 页
            </p>
            {progress.currentUrl && (
              <p className="font-mono text-xs text-archive-muted m-0 mt-0.5 truncate">
                {progress.currentUrl}
              </p>
            )}
            {progress.failed > 0 && (
              <p className="text-xs text-archive-danger m-0 mt-0.5">
                {progress.failed} 个 URL 失败
              </p>
            )}
          </div>
        )}

        <dl className="grid grid-cols-4 gap-3 mt-4 mb-0 text-sm">
          <div>
            <dt className="archive-label m-0">页面</dt>
            <dd className="font-mono text-archive-ink m-0 mt-0.5">
              {source.pageCount > 0 ? (
                <button
                  type="button"
                  className="font-mono text-archive-teal bg-transparent border-0 p-0 cursor-pointer hover:underline"
                  onClick={handleBrowse}
                  title="浏览文档"
                >
                  {source.pageCount}
                </button>
              ) : (
                source.pageCount
              )}
            </dd>
          </div>
          <div>
            <dt className="archive-label m-0">失败</dt>
            <dd className="font-mono text-archive-ink m-0 mt-0.5">{source.failedCount}</dd>
          </div>
          <div>
            <dt className="archive-label m-0">上次同步</dt>
            <dd className="text-archive-ink m-0 mt-0.5 text-xs">
              {formatRelativeTime(source.lastSyncedAt)}
            </dd>
          </div>
          <div>
            <dt className="archive-label m-0">下次同步</dt>
            <dd className="text-archive-ink m-0 mt-0.5 text-xs">
              {source.scheduleEnabled
                ? source.nextRunAt
                  ? formatRelativeTime(source.nextRunAt)
                  : '计算中'
                : '关闭'}
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-archive-line">
          <Tooltip title="抓取方式">
            <Tag variant="filled" className="m-0 text-xs">
              {crawlModeName(source.crawlMode)}
            </Tag>
          </Tooltip>
          {source.scheduleEnabled && (
            <Tooltip title="已开启定时同步">
              <Tag color="blue" icon={<CalendarOutlined />} className="m-0 text-xs">
                定时
              </Tag>
            </Tooltip>
          )}
          {source.needsSpa && source.crawlMode !== 'spa' && (
            <Tooltip title="首屏内容过少，疑似 SPA 站点。SSR 抓取可能不完整，建议在「编辑」中切换为 SPA 模式后重新同步。">
              <Tag color="warning" icon={<WarningOutlined />} className="m-0 text-xs">
                疑似 SPA
              </Tag>
            </Tooltip>
          )}
          <div className="flex-1" />
          {source.pageCount > 0 && (
            <Tooltip title="浏览文档">
              <Button
                aria-label={`浏览 ${source.name}`}
                size="small"
                icon={<ReadOutlined />}
                onClick={handleBrowse}
              />
            </Tooltip>
          )}
          <Tooltip title="编辑文档源">
            <Button
              aria-label={`编辑 ${source.name}`}
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(source.id)}
            />
          </Tooltip>
          {isSyncing ? (
            <Button
              size="small"
              aria-label={`暂停 ${source.name}`}
              icon={<PauseOutlined />}
              loading={pauseMutation.isPending}
              disabled={!canPause}
              onClick={() =>
                pauseMutation.mutate(source.id, {
                  onError: (err) => {
                    message.error(err instanceof Error ? err.message : '暂停失败')
                  }
                })
              }
            >
              {canPause ? '暂停' : '收尾中'}
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              aria-label={`${isPaused ? '继续同步' : '同步'} ${source.name}`}
              icon={<SyncOutlined />}
              loading={syncMutation.isPending}
              onClick={() =>
                syncMutation.mutate(source.id, {
                  onError: (err) => {
                    message.error(err instanceof Error ? err.message : '同步失败')
                  }
                })
              }
            >
              {isPaused ? '继续' : '同步'}
            </Button>
          )}
          <Tooltip title="删除文档源">
            <Button
              aria-label={`删除 ${source.name}`}
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending}
              onClick={handleDelete}
            />
          </Tooltip>
        </div>
      </div>
    </article>
  )
}
