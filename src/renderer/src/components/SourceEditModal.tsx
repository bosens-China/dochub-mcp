import { useEffect } from 'react'
import { Form, Input, InputNumber, Modal, Select, Switch, App } from 'antd'
import type { CrawlMode, UpdateSourceInput } from '@shared/types'
import { useSource, useUpdateSource } from '@renderer/hooks/use-app-data'

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
    UpdateSourceInput & { excludeText: string; customHeaders: Record<string, string> }
  >()

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
          <Form.Item name="seedUrl" label="起始 URL" rules={[{ required: true, type: 'url' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="crawlMode" label="抓取模式" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ssr', label: 'SSR — 静态 HTML' },
                { value: 'spa', label: 'SPA — JS 渲染 (v2)' },
                { value: 'auto', label: '自动检测' }
              ]}
            />
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
    </Modal>
  )
}
