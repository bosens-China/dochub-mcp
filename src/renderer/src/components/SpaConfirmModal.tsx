import { Alert, Modal, Select, Tag, Button, App } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import type { CrawlMode, SpaDetectionResult } from '@shared/types'
import { MarkdownPreview } from '@renderer/components/md/MarkdownPreview'
import { SPA_MARKDOWN_PREVIEW_THRESHOLD } from '@shared/constants/spa-detection'
import {
  CONCRETE_CRAWL_MODE_OPTIONS,
  crawlModeDetail,
  crawlModeName
} from '@renderer/lib/crawl-mode'

interface SpaConfirmModalProps {
  open: boolean
  seedUrl: string
  detection: SpaDetectionResult | null
  loading: boolean
  onConfirm: (mode: CrawlMode) => void
  onCancel: () => void
}

const confidenceLabel: Record<SpaDetectionResult['confidence'], string> = {
  likely_ssr: '适合快速抓取',
  uncertain: '不确定',
  likely_spa: '建议浏览器抓取'
}

const embeddedPreviewClassName =
  'markdown-preview prose prose-stone prose-sm max-w-none font-body px-4 py-3 m-0'

export function SpaConfirmModal({
  open,
  seedUrl,
  detection,
  loading,
  onConfirm,
  onCancel
}: SpaConfirmModalProps): React.JSX.Element {
  const { message } = App.useApp()
  const [selectedMode, setSelectedMode] = useState<CrawlMode>('auto')
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    if (detection && open) {
      let isMounted = true

      const resetSelection = async (): Promise<void> => {
        await Promise.resolve()
        if (!isMounted) return
        setSelectedMode(detection.recommendedMode === 'auto' ? 'ssr' : detection.recommendedMode)
        setPreviewContent(null)
      }

      void resetSelection()
      return () => {
        isMounted = false
      }
    }
    return undefined
  }, [detection, open])

  const handlePreview = async (): Promise<void> => {
    if (!seedUrl) return
    if (selectedMode === 'auto') {
      message.warning('请先选择快速抓取或浏览器抓取，再预览正文')
      return
    }
    setPreviewing(true)
    try {
      const md = await window.api.previewCrawl(seedUrl, selectedMode)
      setPreviewContent(md)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '预览失败')
    } finally {
      setPreviewing(false)
    }
  }
  if (!detection) {
    return (
      <Modal open={open} title="检测页面类型" onCancel={onCancel} footer={null} destroyOnHidden>
        <p className="text-archive-muted">正在抓取首屏 HTML 并转换为 Markdown…</p>
      </Modal>
    )
  }

  const hitSignals = detection.signals.filter((s) => s.hit)
  const currentPreview = previewContent !== null ? previewContent : detection.previewMarkdown
  const concreteMode = selectedMode === 'auto' ? 'ssr' : selectedMode
  const previewEmpty = currentPreview.trim().length === 0
  const previewShort = currentPreview.length < SPA_MARKDOWN_PREVIEW_THRESHOLD

  return (
    <Modal
      open={open}
      title="确认抓取方式"
      onCancel={onCancel}
      onOk={() => onConfirm(concreteMode)}
      okText={`使用${crawlModeName(concreteMode)}并同步`}
      cancelText="取消"
      confirmLoading={loading}
      width={640}
      destroyOnHidden
    >
      <Alert
        type={detection.confidence === 'likely_spa' ? 'warning' : 'info'}
        showIcon
        className="mb-4"
        title={`页面类型判断：${confidenceLabel[detection.confidence]}（得分 ${detection.score}）`}
        description={
          previewShort
            ? `当前只提取到 ${currentPreview.length} 个字符（低于 ${SPA_MARKDOWN_PREVIEW_THRESHOLD}），页面可能需要浏览器渲染。建议切换为浏览器抓取并预览正文。`
            : `当前提取到约 ${currentPreview.length} 个字符。请确认下方预览是否包含你需要的正文。`
        }
      />

      <div className="flex items-center justify-between mb-2">
        <p className="archive-label m-0">
          正文预览{' '}
          {previewContent !== null
            ? `（${crawlModeName(concreteMode)}实时结果）`
            : '（快速抓取检测结果）'}
        </p>
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={handlePreview}
          loading={previewing}
          disabled={selectedMode === 'auto'}
        >
          预览正文
        </Button>
      </div>
      <div className="mb-4 max-h-64 overflow-y-auto rounded border border-archive-line bg-white/80">
        {previewEmpty ? (
          <p className="text-sm text-archive-muted px-4 py-3 m-0">
            还没有提取到正文。请尝试浏览器抓取，或确认 URL 是否需要登录。
          </p>
        ) : (
          <MarkdownPreview content={currentPreview} className={embeddedPreviewClassName} />
        )}
      </div>

      <p className="archive-label mb-2">判断依据</p>
      <ul className="list-none p-0 m-0 mb-4 space-y-1">
        {hitSignals.map((s) => (
          <li key={s.id} className="text-sm text-archive-ink flex items-center gap-2">
            <Tag color="orange">
              {s.weight > 0 ? '+' : ''}
              {s.weight}
            </Tag>
            {s.label}
          </li>
        ))}
        {hitSignals.length === 0 && <li className="text-sm text-archive-muted">无明显 SPA 特征</li>}
      </ul>

      <p className="archive-label mb-2">选择抓取方式</p>
      <Select
        className="w-full"
        value={concreteMode}
        onChange={(mode: CrawlMode) => setSelectedMode(mode)}
        options={CONCRETE_CRAWL_MODE_OPTIONS}
      />
      <p className="text-xs text-archive-muted mt-2 mb-0">{crawlModeDetail(concreteMode)}</p>
    </Modal>
  )
}
