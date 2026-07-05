import { Alert, Modal, App, Statistic } from 'antd'
import { useState, useEffect } from 'react'
import type { CrawlMode } from '@shared/types'
import { MarkdownPreview } from '@renderer/components/md/MarkdownPreview'
import { crawlModeDetail, crawlModeName } from '@renderer/lib/crawl-mode'

interface CrawlPreviewModalProps {
  open: boolean
  seedUrl: string
  mode: CrawlMode
  onClose: () => void
}

export function CrawlPreviewModal({
  open,
  seedUrl,
  mode,
  onClose
}: CrawlPreviewModalProps): React.JSX.Element | null {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { message } = App.useApp()

  useEffect(() => {
    if (open && seedUrl && mode !== 'auto') {
      let isMounted = true

      const loadPreview = async (): Promise<void> => {
        await Promise.resolve()
        if (!isMounted) return
        setLoading(true)
        setContent(null)
        setError(null)
        try {
          const md = await window.api.previewCrawl(seedUrl, mode)
          if (isMounted) setContent(md)
        } catch (err) {
          const reason = err instanceof Error ? err.message : '预览失败'
          if (isMounted) {
            setError(reason)
            message.error(reason)
          }
        } finally {
          if (isMounted) setLoading(false)
        }
      }

      void loadPreview()
      return () => {
        isMounted = false
      }
    }
    return undefined
  }, [open, seedUrl, mode, message])

  if (!open) return null

  return (
    <Modal
      open={open}
      title={`${crawlModeName(mode)}预览`}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded border border-archive-line bg-archive-paper px-3 py-2">
          <p className="archive-label m-0">抓取方式</p>
          <p className="text-sm text-archive-ink m-0 mt-1">{crawlModeName(mode)}</p>
          <p className="text-xs text-archive-muted m-0 mt-1">{crawlModeDetail(mode)}</p>
        </div>
        <div className="rounded border border-archive-line bg-archive-paper px-3 py-2">
          <Statistic
            title="提取到的 Markdown 字符"
            value={content?.trim().length ?? 0}
            loading={loading}
          />
        </div>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          className="mb-3"
          title="预览失败"
          description="请检查 URL 是否可访问，或确认该文档站是否需要登录后才能读取。"
        />
      )}

      {!error && !loading && content !== null && content.trim().length < 120 && (
        <Alert
          type="warning"
          showIcon
          className="mb-3"
          title="正文很少"
          description={
            mode === 'ssr'
              ? '如果这里看不到正文，可以切换为浏览器抓取后再预览。'
              : '如果浏览器抓取仍没有正文，页面可能需要登录或正文不在起始 URL 中。'
          }
        />
      )}

      <div className="max-h-96 overflow-y-auto rounded border border-archive-line bg-white/80 p-0">
        {loading ? (
          <p className="text-archive-muted p-4 m-0">正在抓取页面并转换为 Markdown…</p>
        ) : content ? (
          <MarkdownPreview
            content={content}
            className="markdown-preview prose prose-stone prose-sm max-w-none font-body px-4 py-3 m-0"
          />
        ) : (
          <p className="text-archive-muted p-4 m-0">
            暂未提取到正文。你可以切换抓取方式，或检查起始 URL 是否是具体文档页。
          </p>
        )}
      </div>
    </Modal>
  )
}
