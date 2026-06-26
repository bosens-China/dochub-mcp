import { useState, useRef } from 'react'
import { Empty, Input, Select, Spin, Tag, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useSearchDocuments, useSources } from '@renderer/hooks/use-app-data'
import type { SearchResult } from '@shared/types'
import { useRouter } from '@tanstack/react-router'

const { Text } = Typography

function ResultCard({
  result,
  onNavigate
}: {
  result: SearchResult
  onNavigate: (sourceId: string, docPath: string) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="w-full text-left bg-white rounded-lg border border-archive-line px-5 py-4 hover:border-archive-teal hover:shadow-sm transition-all cursor-pointer group"
      onClick={() => onNavigate(result.sourceId, result.docPath)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-body font-medium text-archive-ink m-0 group-hover:text-archive-teal transition-colors truncate">
            {result.title}
          </p>
          <p className="font-mono text-xs text-archive-muted m-0 mt-0.5 truncate">
            {result.docPath}
          </p>
          <div
            className="text-sm text-archive-muted mt-2 mb-0 leading-relaxed line-clamp-2 [&_b]:text-archive-teal [&_b]:font-medium"
            // snippet 含 FTS 高亮 <b> 标签
            dangerouslySetInnerHTML={{ __html: result.snippet }}
          />
        </div>
        <Tag color="cyan" className="shrink-0 font-mono text-xs">
          {result.sourceName}
        </Tag>
      </div>
    </button>
  )
}

export function SearchPage(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: sources } = useSources()
  const { data: results, isFetching } = useSearchDocuments(debouncedQuery, selectedSource)
  const router = useRouter()

  const handleQueryChange = (value: string): void => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim())
    }, 300)
  }

  const handleNavigate = (sourceId: string, docPath: string): void => {
    void router.navigate({
      to: '/browse',
      search: { sourceId, path: docPath }
    })
  }

  const sourceOptions = [
    { value: '__all__', label: '全部来源' },
    ...(sources ?? []).map((s) => ({ value: s.id, label: s.name }))
  ]

  const hasResults = results && results.length > 0
  const isEmpty = debouncedQuery.length > 0 && !isFetching && !hasResults

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 px-8 pt-8 pb-4 border-b border-archive-line">
        <p className="archive-label m-0">全文检索</p>
        <h1 className="font-display text-2xl text-archive-ink m-0 mt-1 font-semibold">搜索</h1>
      </header>

      <div className="shrink-0 px-8 py-4 border-b border-archive-line flex gap-3">
        <Input
          id="search-query-input"
          prefix={<SearchOutlined className="text-archive-muted" />}
          placeholder="输入关键词搜索本地文档…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          allowClear
          size="large"
          className="flex-1"
          autoFocus
        />
        <Select
          id="search-source-filter"
          value={selectedSource ?? '__all__'}
          onChange={(v: string) => setSelectedSource(v === '__all__' ? null : v)}
          options={sourceOptions}
          size="large"
          className="w-44"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isFetching && (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        )}

        {!isFetching && isEmpty && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text className="text-archive-muted">
                未找到与 <Text code>{debouncedQuery}</Text> 相关的文档
              </Text>
            }
          />
        )}

        {!isFetching && !debouncedQuery && (
          <div className="flex flex-col items-center justify-center py-24 text-archive-muted">
            <SearchOutlined className="text-4xl mb-4 opacity-30" />
            <p className="text-sm m-0">输入关键词开始搜索</p>
          </div>
        )}

        {!isFetching && hasResults && (
          <>
            <p className="text-xs text-archive-muted mb-4 m-0">共找到 {results.length} 条结果</p>
            <div className="flex flex-col gap-3">
              {results.map((r, i) => (
                <ResultCard
                  key={`${r.sourceId}::${r.docPath}::${i}`}
                  result={r}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
