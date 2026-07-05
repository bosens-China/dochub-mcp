import { useState } from 'react'
import { EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Empty, Form, Input, InputNumber, Modal, Select } from 'antd'
import type { CrawlMode } from '@shared/types'
import { generateSourceName } from '@renderer/lib/format'
import { useAddSource, useDetectSpa, useSources } from '@renderer/hooks/use-app-data'
import { ScopeDepthInput } from '@renderer/components/ScopeDepthInput'
import { SourceEditModal } from '@renderer/components/SourceEditModal'
import { SpaConfirmModal } from '@renderer/components/SpaConfirmModal'
import { CrawlPreviewModal } from '@renderer/components/CrawlPreviewModal'
import { CRAWL_MODE_SELECT_OPTIONS } from '@renderer/lib/crawl-mode'
import { SourceCard } from '@renderer/components/SourceCard'

export function SourcesPage(): React.JSX.Element {
  const { message } = App.useApp()
  const { data: sources = [], isLoading } = useSources()
  const addMutation = useAddSource()
  const detectMutation = useDetectSpa()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [spaOpen, setSpaOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pendingAdd, setPendingAdd] = useState<{
    name: string
    seedUrl: string
    crawlMode: CrawlMode
    maxPages?: number | null
    pathPrefix?: string
  } | null>(null)
  const [form] = Form.useForm<{
    name: string
    seedUrl: string
    crawlMode: CrawlMode
    maxPages?: number | null
    pathPrefix?: string
  }>()
  const seedUrlValue = Form.useWatch('seedUrl', form)
  const crawlModeValue = Form.useWatch('crawlMode', form)

  const submitAdd = async (values: {
    name: string
    seedUrl: string
    crawlMode: CrawlMode
    maxPages?: number | null
    pathPrefix?: string
  }): Promise<void> => {
    if (values.crawlMode === 'auto') {
      setPendingAdd(values)
      setSpaOpen(true)
      try {
        const detection = await detectMutation.mutateAsync(values.seedUrl)
        if (detection.previewCharCount === 0) {
          await addMutation.mutateAsync({ ...values, crawlMode: 'spa' })
          message.success('未检测到正文，已自动以 SPA 模式添加并同步…')
          form.resetFields()
          setAddOpen(false)
          setSpaOpen(false)
          return
        }
        setPendingAdd({ ...values, crawlMode: detection.recommendedMode })
      } catch (err) {
        message.error(err instanceof Error ? err.message : '页面类型检测失败')
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

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const url = e.target.value
    const currentName = form.getFieldValue('name')
    if (!currentName && url) {
      const generated = generateSourceName(url)
      if (generated !== url) {
        form.setFieldValue('name', generated)
      }
    }
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
        okText={
          detectMutation.isPending
            ? '正在检测页面类型…'
            : (crawlModeValue ?? 'auto') === 'auto'
              ? '检测并添加'
              : '添加并同步'
        }
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="seedUrl"
            label="起始 URL"
            extra="输入任意一篇文档页地址，后面可选择只抓当前目录或扩大到上级目录。"
            rules={[
              { required: true, message: '请输入文档页 URL' },
              { type: 'url', message: '请输入有效的 URL' }
            ]}
          >
            <Input placeholder="https://electron-vite.org/guide/" onChange={handleUrlChange} />
          </Form.Item>
          {seedUrlValue && (
            <Form.Item name="pathPrefix" className="mb-4">
              <ScopeDepthInput seedUrl={seedUrlValue} />
            </Form.Item>
          )}
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入源名称' }]}>
            <Input placeholder="例如 Electron-Vite" />
          </Form.Item>
          <Form.Item
            label="抓取方式"
            className="mb-0"
            extra="自动判断会先预览页面正文，再让你确认最终抓取方式。"
          >
            <div className="flex items-center gap-2 mb-4">
              <Form.Item name="crawlMode" initialValue="auto" noStyle>
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
          <Form.Item name="maxPages" label="最大抓取页数">
            <InputNumber min={1} className="w-full" placeholder="留空表示不限制" />
          </Form.Item>
        </Form>
      </Modal>

      <SpaConfirmModal
        open={spaOpen}
        seedUrl={pendingAdd?.seedUrl ?? ''}
        detection={detectMutation.data ?? null}
        loading={addMutation.isPending}
        onConfirm={(mode) => void handleSpaConfirm(mode)}
        onCancel={() => {
          setSpaOpen(false)
          setPendingAdd(null)
        }}
      />

      <SourceEditModal sourceId={editId} open={Boolean(editId)} onClose={() => setEditId(null)} />

      <CrawlPreviewModal
        open={previewOpen}
        seedUrl={seedUrlValue ?? ''}
        mode={crawlModeValue ?? 'auto'}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  )
}
