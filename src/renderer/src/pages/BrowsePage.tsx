import { useState } from 'react'
import { Empty, Select, Spin, Menu, Button, App, Tooltip, Splitter } from 'antd'
import type { MenuProps } from 'antd'
import { FolderOpenOutlined, CopyOutlined, SyncOutlined, RollbackOutlined } from '@ant-design/icons'
import type { DocTreeNode } from '@shared/types'
import { MarkdownPreview } from '@renderer/components/md/MarkdownPreview'
import { useDocContent, useDocTree, useSources, useTriggerSync } from '@renderer/hooks/use-app-data'
import { useNavigate, useSearch } from '@tanstack/react-router'

type MenuItem = Required<MenuProps>['items'][number]

function toAntMenuItems(nodes: DocTreeNode[]): MenuItem[] {
  return nodes.map((node) => ({
    key: node.key,
    label: node.title,
    children: node.children && node.children.length > 0 ? toAntMenuItems(node.children) : undefined
  }))
}

function getAllFolderKeys(nodes: DocTreeNode[]): string[] {
  const keys: string[] = []
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      keys.push(node.key)
      keys.push(...getAllFolderKeys(node.children))
    }
  }
  return keys
}

export function BrowsePage(): React.JSX.Element {
  const { data: sources = [] } = useSources()
  const navigate = useNavigate({ from: '/browse/' })
  // 从搜索页跳转时携带的 URL 参数（可选）
  const searchParams = useSearch({ from: '/browse/' })

  // 用户手动切换的源 / 文档，优先级高于 URL 参数
  const [manualSourceId, setManualSourceId] = useState<string | null>(null)
  const [manualPath, setManualPath] = useState<string | null>(null)

  // 派生最终选中值：用户操作 > URL 参数 > 默认第一个源
  const activeSourceId = manualSourceId ?? searchParams.sourceId ?? sources[0]?.id ?? null
  const selectedPath = manualPath ?? searchParams.path ?? null

  const { data: tree = [], isLoading: treeLoading } = useDocTree(activeSourceId)
  const { data: doc, isLoading: contentLoading } = useDocContent(activeSourceId, selectedPath)
  const syncMutation = useTriggerSync()

  const activeSource = sources.find((s) => s.id === activeSourceId)
  const { message } = App.useApp()

  const handleCopy = async (): Promise<void> => {
    if (!doc?.body) return
    try {
      await navigator.clipboard.writeText(doc.body)
      message.success('文档内容已复制到剪贴板')
    } catch {
      message.error('复制失败')
    }
  }

  const handleOpenFolder = async (): Promise<void> => {
    if (!activeSourceId || !selectedPath) return
    try {
      await window.api.openFolder(activeSourceId, selectedPath)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '打开文件夹失败')
    }
  }

  const handleResync = (): void => {
    if (!activeSourceId) return
    syncMutation.mutate(activeSourceId, {
      onError: (err) => {
        message.error(err instanceof Error ? err.message : '同步失败')
      },
      onSuccess: () => {
        message.success('已开始重新同步')
      }
    })
  }

  const handleBackToTree = (): void => {
    setManualPath(null)
    void navigate({ search: { sourceId: activeSourceId ?? undefined, path: undefined } })
  }

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 px-8 pt-8 pb-4 border-b border-archive-line">
        <p className="archive-label m-0">阅读</p>
        <div className="flex items-center justify-between gap-4 mt-1">
          <h1 className="font-display text-2xl text-archive-ink m-0 font-semibold">浏览文档</h1>
          <Select
            className="min-w-52"
            value={activeSourceId ?? undefined}
            placeholder="选择文档源"
            options={sources.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(id) => {
              setManualSourceId(id)
              setManualPath(null)
              void navigate({ search: { sourceId: id, path: undefined } })
            }}
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <Splitter>
          <Splitter.Panel defaultSize={256} min={200} max={600} collapsible>
            <section className="h-full flex flex-col bg-archive-shelf/30 border-r border-archive-line/30">
              <div className="px-4 py-3 border-b border-archive-line">
                <p className="archive-label m-0">目录</p>
                {activeSource && (
                  <p className="text-xs text-archive-muted m-0 mt-1 truncate">
                    {activeSource.name}
                  </p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {treeLoading ? (
                  <Spin className="block mx-auto mt-8" />
                ) : tree.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无文档"
                    className="mt-8"
                  />
                ) : (
                  <Menu
                    mode="inline"
                    defaultOpenKeys={getAllFolderKeys(tree)}
                    selectedKeys={selectedPath ? [selectedPath] : []}
                    items={toAntMenuItems(tree)}
                    className="border-r-0 bg-transparent"
                    onSelect={(info) => {
                      const key = info.key
                      if (typeof key === 'string' && key.endsWith('.md')) {
                        setManualPath(key)
                        void navigate({
                          search: {
                            sourceId: activeSourceId ?? undefined,
                            path: key
                          }
                        })
                      }
                    }}
                  />
                )}
              </div>
            </section>
          </Splitter.Panel>
          <Splitter.Panel>
            <section className="h-full min-w-0 bg-white/60">
              {!selectedPath ? (
                <div className="h-full flex items-center justify-center">
                  <Empty description="从左侧选择一篇文档开始阅读" />
                </div>
              ) : contentLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Spin description="加载文档…" />
                </div>
              ) : !doc ? (
                <div className="h-full flex items-center justify-center">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div>
                        <p className="text-archive-danger m-0">无法找到或读取该文档</p>
                        {selectedPath && (
                          <p className="font-mono text-xs text-archive-muted mt-1 mb-0">
                            {selectedPath}
                          </p>
                        )}
                        <p className="text-xs text-archive-muted mt-2 mb-0">
                          该文件可能已被站点移除，或本地镜像还没有同步完成。
                        </p>
                      </div>
                    }
                  >
                    <div className="flex justify-center gap-2">
                      <Button icon={<RollbackOutlined />} onClick={handleBackToTree}>
                        回到目录
                      </Button>
                      <Button
                        type="primary"
                        icon={<SyncOutlined spin={syncMutation.isPending} />}
                        loading={syncMutation.isPending}
                        onClick={handleResync}
                      >
                        重新同步此源
                      </Button>
                    </div>
                  </Empty>
                </div>
              ) : (
                <div className="h-full flex flex-col min-h-0">
                  <header className="shrink-0 px-6 pt-5 pb-3 border-b border-archive-line/60 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-display text-xl text-archive-ink m-0 font-semibold leading-snug">
                        {doc?.title ?? selectedPath}
                      </h2>
                      {doc?.title && selectedPath && (
                        <p className="text-xs text-archive-muted m-0 mt-1 font-mono truncate">
                          {selectedPath}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Tooltip title="复制文档内容">
                        <Button
                          aria-label="复制文档内容"
                          icon={<CopyOutlined />}
                          size="small"
                          onClick={() => void handleCopy()}
                        />
                      </Tooltip>
                      <Tooltip title="在系统资源管理器中打开">
                        <Button
                          aria-label="在系统资源管理器中打开"
                          icon={<FolderOpenOutlined />}
                          size="small"
                          onClick={() => void handleOpenFolder()}
                        />
                      </Tooltip>
                    </div>
                  </header>
                  <MarkdownPreview content={doc?.body ?? ''} />
                </div>
              )}
            </section>
          </Splitter.Panel>
        </Splitter>
      </div>
    </div>
  )
}
