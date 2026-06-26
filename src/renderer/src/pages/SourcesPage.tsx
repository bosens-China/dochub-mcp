import { useState } from 'react'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReadOutlined,
  SyncOutlined,
  LinkOutlined
} from '@ant-design/icons'
import { Button, Empty, Modal, Form, Input, Select, Tag, Tooltip, App, Progress } from 'antd'
import { useRouter } from '@tanstack/react-router'
import type { CrawlMode, DocSource } from '@shared/types'
import {
  formatRelativeTime,
  syncStatusColor,
  syncStatusLabel,
  truncateUrl
} from '@renderer/lib/format'
import {
  useAddSource,
  useDeleteSource,
  useDetectSpa,
  useSourceSyncProgress,
  useSources,
  useTriggerSync
} from '@renderer/hooks/use-app-data'
import { SourceEditModal } from '@renderer/components/SourceEditModal'
import { SpaConfirmModal } from '@renderer/components/SpaConfirmModal'

function SourceCard({
  source,
  onEdit
}: {
  source: DocSource
  onEdit: (id: string) => void
}): React.JSX.Element {
  const { message, modal } = App.useApp()
  const router = useRouter()
  const syncMutation = useTriggerSync()
  const deleteMutation = useDeleteSource()
  const progress = useSourceSyncProgress(source.id)
  const isSyncing = source.status === 'syncing' || progress !== null

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
              format={() => `${progress.completed}/${progress.total}`}
            />
            <p className="text-xs text-archive-ink m-0 mt-1.5">{progress.message}</p>
            {progress.currentUrl && (
              <p className="font-mono text-xs text-archive-muted m-0 mt-0.5 truncate">
                {progress.currentUrl}
              </p>
            )}
            {progress.failed > 0 && (
              <p className="text-xs text-archive-danger m-0 mt-0.5">{progress.failed} 个 URL 失败</p>
            )}
          </div>
        )}

        <dl className="grid grid-cols-3 gap-3 mt-4 mb-0 text-sm">
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
        </dl>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-archive-line">
          <Tooltip title="抓取模式">
            <Tag variant="filled" className="m-0 uppercase text-xs">
              {source.crawlMode}
            </Tag>
          </Tooltip>
          <div className="flex-1" />
          {source.pageCount > 0 && (
            <Tooltip title="浏览文档">
              <Button size="small" icon={<ReadOutlined />} onClick={handleBrowse} />
            </Tooltip>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(source.id)} />
          <Button
            type="primary"
            size="small"
            icon={<SyncOutlined spin={isSyncing} />}
            loading={syncMutation.isPending}
            disabled={isSyncing}
            onClick={() =>
              syncMutation.mutate(source.id, {
                onError: (err) => {
                  message.error(err instanceof Error ? err.message : '同步失败')
                }
              })
            }
          >
            同步
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          />
        </div>
      </div>
    </article>
  )
}

export function SourcesPage(): React.JSX.Element {
  const { message } = App.useApp()
  const { data: sources = [], isLoading } = useSources()
  const addMutation = useAddSource()
  const detectMutation = useDetectSpa()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [spaOpen, setSpaOpen] = useState(false)
  const [pendingAdd, setPendingAdd] = useState<{
    name: string
    seedUrl: string
    crawlMode: CrawlMode
  } | null>(null)
  const [form] = Form.useForm<{ name: string; seedUrl: string; crawlMode: CrawlMode }>()

  const submitAdd = async (values: {
    name: string
    seedUrl: string
    crawlMode: CrawlMode
  }): Promise<void> => {
    if (values.crawlMode === 'auto') {
      setPendingAdd(values)
      setSpaOpen(true)
      try {
        const detection = await detectMutation.mutateAsync(values.seedUrl)
        if (detection.confidence === 'likely_ssr') {
          await addMutation.mutateAsync({ ...values, crawlMode: 'ssr' })
          message.success('文档源已添加，正在同步…')
          form.resetFields()
          setAddOpen(false)
          setSpaOpen(false)
          return
        }
        setPendingAdd({ ...values, crawlMode: detection.recommendedMode })
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'SPA 检测失败')
        setSpaOpen(false)
      }
      return
    }

    await addMutation.mutateAsync(values)
    message.success('文档源已添加，正在同步…')
    form.resetFields()
    setAddOpen(false)
  }

  const handleSpaConfirm = async (mode: CrawlMode): Promise<void> => {
    if (!pendingAdd) return
    await addMutation.mutateAsync({ ...pendingAdd, crawlMode: mode })
    message.success('文档源已添加，正在同步…')
    form.resetFields()
    setAddOpen(false)
    setSpaOpen(false)
    setPendingAdd(null)
  }

  const handleAdd = async (): Promise<void> => {
    const values = await form.validateFields()
    await submitAdd(values)
  }

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 px-8 pt-8 pb-4 border-b border-archive-line">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="archive-label m-0">索引</p>
            <h1 className="font-display text-2xl text-archive-ink m-0 mt-1 font-semibold">
              文档源
            </h1>
            <p className="text-archive-muted text-sm mt-2 mb-0 max-w-xl">
              添加文档站 URL，DocHub 只抓取路径前缀下的内容并镜像到本地。
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            添加源
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <p className="text-archive-muted">加载中…</p>
        ) : sources.length === 0 ? (
          <Empty description="还没有文档源">
            <Button type="primary" onClick={() => setAddOpen(true)}>
              添加第一个源
            </Button>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {sources.map((source) => (
              <SourceCard key={source.id} source={source} onEdit={setEditId} />
            ))}
          </div>
        )}
      </div>

      <Modal
        title="添加文档源"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => void handleAdd()}
        confirmLoading={addMutation.isPending || detectMutation.isPending}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入源名称' }]}>
            <Input placeholder="例如 Electron-Vite" />
          </Form.Item>
          <Form.Item
            name="seedUrl"
            label="起始 URL"
            rules={[
              { required: true, message: '请输入文档页 URL' },
              { type: 'url', message: '请输入有效的 URL' }
            ]}
          >
            <Input placeholder="https://electron-vite.org/guide/" />
          </Form.Item>
          <Form.Item name="crawlMode" label="抓取模式" initialValue="auto">
            <Select
              options={[
                { value: 'ssr', label: 'SSR — 静态 HTML' },
                { value: 'spa', label: 'SPA — JS 渲染 (v2)' },
                { value: 'auto', label: '自动检测（推荐）' }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <SpaConfirmModal
        open={spaOpen}
        detection={detectMutation.data ?? null}
        loading={addMutation.isPending}
        onConfirm={(mode) => void handleSpaConfirm(mode)}
        onCancel={() => {
          setSpaOpen(false)
          setPendingAdd(null)
        }}
      />

      <SourceEditModal sourceId={editId} open={Boolean(editId)} onClose={() => setEditId(null)} />
    </div>
  )
}
