import { useState, useEffect } from 'react'
import { Form, Input, InputNumber, Modal, Select, Switch, App, Button } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import type { CrawlMode, UpdateSourceInput } from '@shared/types'
import { useSource, useUpdateSource } from '@renderer/hooks/use-app-data'
import { ScopeDepthInput } from '@renderer/components/ScopeDepthInput'
import { CrawlPreviewModal } from '@renderer/components/CrawlPreviewModal'
import { CRAWL_MODE_SELECT_OPTIONS } from '@renderer/lib/crawl-mode'

interface SourceEditModalProps {
  sourceId: string | null
  open: boolean
  onClose: () => void
}

export function SourceEditModal({
  sourceId,
  open,
  onClose
}: SourceEditModalProps): React.JSX.Element {
  const { message } = App.useApp()
  const { data: source, isLoading } = useSource(sourceId)
  const updateMutation = useUpdateSource()
  const [form] = Form.useForm<
    UpdateSourceInput & {
      excludeText: string
      customHeaders: Record<string, string>
      maxPages?: number | null
      pathPrefix?: string
    }
  >()
  const seedUrlValue = Form.useWatch('seedUrl', form)
  const crawlModeValue = Form.useWatch('crawlMode', form)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (source && open) {
      form.setFieldsValue({
        id: source.id,
        name: source.name,
        seedUrl: source.seedUrl,
        crawlMode: source.crawlMode,
        respectRobots: source.respectRobots,
        concurrency: source.concurrency,
        maxRetriesPerUrl: source.maxRetriesPerUrl,
        maxPages: source.maxPages,
        pathPrefix: source.pathPrefix,
        excludeText: source.excludePatterns.join('\n'),
        customHeaders: source.customHeaders
      })
    }
  }, [form, source, open])

  const handleSave = async (): Promise<void> => {
    if (!sourceId) return
    const values = await form.validateFields()
    const excludePatterns = values.excludeText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    await updateMutation.mutateAsync({
      id: sourceId,
      name: values.name,
      seedUrl: values.seedUrl,
      crawlMode: values.crawlMode as CrawlMode,
      respectRobots: values.respectRobots,
      concurrency: values.concurrency,
      maxRetriesPerUrl: values.maxRetriesPerUrl,
      maxPages: values.maxPages ?? null,
      pathPrefix: values.pathPrefix,
      excludePatterns,
      customHeaders: values.customHeaders
    })
    message.success('文档源已更新')
    onClose()
  }

  return (
    <Modal
      title="编辑文档源"
      open={open}
      onCancel={onClose}
      onOk={() => void handleSave()}
      confirmLoading={updateMutation.isPending || isLoading}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={560}
    >
      {source ? (
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="seedUrl"
            label="起始 URL"
            extra="修改地址后，抓取范围会按新路径重新计算。"
            rules={[{ required: true, type: 'url' }]}
          >
            <Input />
          </Form.Item>
          {(source.siteTitle || source.siteLang || source.siteCharset) && (
            <p className="text-xs text-archive-muted -mt-2 mb-4">
              站点信息：
              {source.siteTitle && <span className="text-archive-ink">{source.siteTitle}</span>}
              {source.siteLang && <span className="ml-2">lang={source.siteLang}</span>}
              {source.siteCharset && <span className="ml-2">charset={source.siteCharset}</span>}
            </p>
          )}
          {seedUrlValue && (
            <Form.Item name="pathPrefix" className="mb-4">
              <ScopeDepthInput seedUrl={seedUrlValue} />
            </Form.Item>
          )}
          <Form.Item
            label="抓取方式"
            className="mb-0"
            required
            extra="自动判断会在同步开始时检测页面类型；手动选择后可先预览正文。"
          >
            <div className="flex items-center gap-2 mb-4">
              <Form.Item name="crawlMode" rules={[{ required: true }]} noStyle>
                <Select className="flex-1" options={CRAWL_MODE_SELECT_OPTIONS} />
              </Form.Item>
              <Form.Item
                shouldUpdate={(prev, cur) =>
                  prev.crawlMode !== cur.crawlMode || prev.seedUrl !== cur.seedUrl
                }
                noStyle
              >
                {({ getFieldValue }) => {
                  const mode = getFieldValue('crawlMode') as CrawlMode
                  const url = getFieldValue('seedUrl') as string
                  if (mode === 'auto' || !url) return null
                  return (
                    <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
                      预览正文
                    </Button>
                  )
                }}
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item name="respectRobots" label="遵守 robots.txt" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="concurrency" label="并发数">
            <InputNumber min={1} max={10} className="w-full" />
          </Form.Item>
          <Form.Item name="maxRetriesPerUrl" label="单 URL 最大重试">
            <InputNumber min={1} max={10} className="w-full" />
          </Form.Item>
          <Form.Item name="maxPages" label="最大抓取页数">
            <InputNumber min={1} className="w-full" placeholder="留空表示不限制" />
          </Form.Item>
          <Form.Item
            name="excludeText"
            label="排除路径（每行一条，支持 * 通配）"
            extra="例如 /api/* 或 /changelog/*"
          >
            <Input.TextArea rows={3} placeholder="/api/*" />
          </Form.Item>
        </Form>
      ) : (
        <p className="text-archive-muted py-4">加载中…</p>
      )}

      <CrawlPreviewModal
        open={previewOpen}
        seedUrl={seedUrlValue ?? ''}
        mode={crawlModeValue ?? 'auto'}
        onClose={() => setPreviewOpen(false)}
      />
    </Modal>
  )
}
