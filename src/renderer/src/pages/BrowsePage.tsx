import { useState } from 'react'
import { Empty, Select, Spin, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { DocTreeNode } from '@shared/types'
import { MarkdownPreview } from '@renderer/components/md/MarkdownPreview'
import { useDocContent, useDocTree, useSources } from '@renderer/hooks/use-app-data'
import { useNavigate, useSearch } from '@tanstack/react-router'

function toAntTree(nodes: DocTreeNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.key,
    title: node.title,
    isLeaf: node.isLeaf,
    children: node.children ? toAntTree(node.children) : undefined
  }))
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

  const activeSource = sources.find((s) => s.id === activeSourceId)

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

      <div className="flex-1 flex min-h-0">
        <section className="w-64 shrink-0 border-r border-archive-line flex flex-col bg-archive-shelf/30">
          <div className="px-4 py-3 border-b border-archive-line">
            <p className="archive-label m-0">目录</p>
            {activeSource && (
              <p className="text-xs text-archive-muted m-0 mt-1 truncate">{activeSource.name}</p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {treeLoading ? (
              <Spin className="block mx-auto mt-8" />
            ) : tree.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文档" className="mt-8" />
            ) : (
              <Tree
                showLine
                defaultExpandAll
                selectedKeys={selectedPath ? [selectedPath] : []}
                treeData={toAntTree(tree)}
                onSelect={(keys) => {
                  const key = keys[0]
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

        <section className="flex-1 min-w-0 bg-white/60">
          {!selectedPath ? (
            <div className="h-full flex items-center justify-center">
              <Empty description="从左侧选择一篇文档开始阅读" />
            </div>
          ) : contentLoading ? (
            <div className="h-full flex items-center justify-center">
              <Spin description="加载文档…" />
            </div>
          ) : (
            <div className="h-full flex flex-col min-h-0">
              <header className="shrink-0 px-6 pt-5 pb-3 border-b border-archive-line/60">
                <h2 className="font-display text-xl text-archive-ink m-0 font-semibold leading-snug">
                  {doc?.title ?? selectedPath}
                </h2>
                {doc?.title && selectedPath && (
                  <p className="text-xs text-archive-muted m-0 mt-1 font-mono truncate">
                    {selectedPath}
                  </p>
                )}
              </header>
              <MarkdownPreview content={doc?.body ?? ''} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
