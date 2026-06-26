import { Alert, Modal, Select, Tag } from 'antd'
import type { CrawlMode, SpaDetectionResult } from '@shared/types'

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
        <p className="text-archive-muted">正在分析起始页…</p>
      </Modal>
    )
  }

  const hitSignals = detection.signals.filter((s) => s.hit)

  return (
    <Modal
      open={open}
      title="确认抓取模式"
      onCancel={onCancel}
      onOk={() => onConfirm(detection.recommendedMode)}
      okText={`使用推荐：${detection.recommendedMode}`}
      cancelText="取消"
      confirmLoading={loading}
      width={560}
      destroyOnHidden
    >
      <Alert
        type={detection.confidence === 'likely_spa' ? 'warning' : 'info'}
        showIcon
        className="mb-4"
        title={`检测结果：${confidenceLabel[detection.confidence]}（得分 ${detection.score}）`}
        description={`预览 Markdown 约 ${detection.previewCharCount} 字符。SPA 站点可能需要 JS 渲染（v2），当前仅支持 SSR 抓取。`}
      />

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
