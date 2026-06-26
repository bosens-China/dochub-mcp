import { Alert, Modal, Select, Tag } from 'antd'
import type { CrawlMode, SpaDetectionResult } from '@shared/types'
import { MarkdownPreview } from '@renderer/components/md/MarkdownPreview'
import { SPA_MARKDOWN_PREVIEW_THRESHOLD } from '@shared/constants/spa-detection'

interface SpaConfirmModalProps {
  open: boolean
  detection: SpaDetectionResult | null
  loading: boolean
  onConfirm: (mode: CrawlMode) => void
  onCancel: () => void
}

const confidenceLabel: Record<SpaDetectionResult['confidence'], string> = {
  likely_ssr: '疑似 SSR',
  uncertain: '不确定',
  likely_spa: '疑似 SPA'
}

const embeddedPreviewClassName =
  'markdown-preview prose prose-stone prose-sm max-w-none font-body px-4 py-3 m-0'

export function SpaConfirmModal({
  open,
  detection,
  loading,
  onConfirm,
  onCancel
}: SpaConfirmModalProps): React.JSX.Element {
  if (!detection) {
    return (
      <Modal open={open} title="检测页面类型" onCancel={onCancel} footer={null} destroyOnHidden>
        <p className="text-archive-muted">正在抓取首屏 HTML 并转换为 Markdown…</p>
      </Modal>
    )
  }

  const hitSignals = detection.signals.filter((s) => s.hit)
  const previewEmpty = detection.previewMarkdown.trim().length === 0
  const previewShort = detection.previewCharCount < SPA_MARKDOWN_PREVIEW_THRESHOLD

  return (
    <Modal
      open={open}
      title="确认抓取模式"
      onCancel={onCancel}
      onOk={() => onConfirm(detection.recommendedMode)}
      okText={`使用推荐：${detection.recommendedMode}`}
      cancelText="取消"
      confirmLoading={loading}
      width={640}
      destroyOnHidden
    >
      <Alert
        type={detection.confidence === 'likely_spa' ? 'warning' : 'info'}
        showIcon
        className="mb-4"
        title={`检测结果：${confidenceLabel[detection.confidence]}（得分 ${detection.score}）`}
        description={
          previewShort
            ? `首屏 Markdown 仅 ${detection.previewCharCount} 字符（低于 ${SPA_MARKDOWN_PREVIEW_THRESHOLD}），大概率需 JS 渲染。当前仅支持 SSR 抓取，内容可能不完整。`
            : `首屏 Markdown 约 ${detection.previewCharCount} 字符。请对照下方预览确认是否抓到了有效正文。`
        }
      />

      <p className="archive-label mb-2">首屏 Markdown 预览</p>
      <div className="mb-4 max-h-64 overflow-y-auto rounded border border-archive-line bg-white/80">
        {previewEmpty ? (
          <p className="text-sm text-archive-muted px-4 py-3 m-0">
            首屏几乎无 Markdown 内容，疑似 SPA 壳页面
          </p>
        ) : (
          <MarkdownPreview
            content={detection.previewMarkdown}
            className={embeddedPreviewClassName}
          />
        )}
      </div>

      <p className="archive-label mb-2">命中信号</p>
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

      <p className="archive-label mb-2">手动选择模式</p>
      <Select
        className="w-full"
        defaultValue={detection.recommendedMode}
        onChange={(mode: CrawlMode) => onConfirm(mode)}
        options={[
          { value: 'ssr', label: 'SSR — 静态 HTML（推荐静态文档站）' },
          { value: 'spa', label: 'SPA — 预留 JS 渲染（当前等同 SSR）' },
          { value: 'auto', label: '自动 — 同步时再检测' }
        ]}
      />
    </Modal>
  )
}
