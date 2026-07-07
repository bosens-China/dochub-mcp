import { useEffect } from 'react'
import { Alert, AutoComplete, Button, Form, Input, InputNumber, Switch, Tag } from 'antd'
import type { AppSettings } from '@shared/types'
import { useOllamaStatus } from '@renderer/hooks/use-app-data'

function isLikelyMultilingualModel(model: string): boolean {
  const normalized = model.toLowerCase()
  return ['nomic', 'bge-m3', 'bge-multilingual', 'm3', 'multilingual'].some((token) =>
    normalized.includes(token)
  )
}

export function OllamaSettingsTab({
  settings,
  onSave
}: {
  settings: AppSettings
  onSave: (values: Partial<AppSettings>) => void
}): React.JSX.Element {
  const [form] = Form.useForm<AppSettings['ollama']>()
  const { data: status, isFetching, refetch } = useOllamaStatus()

  useEffect(() => {
    form.setFieldsValue(settings.ollama)
  }, [form, settings.ollama])

  const modelOptions =
    status?.models.map((model) => ({
      value: model.name,
      label: model.name
    })) ?? []
  const embeddingModel = Form.useWatch('embeddingModel', form) ?? settings.ollama.embeddingModel
  const multilingualReady = isLikelyMultilingualModel(embeddingModel)

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-archive-muted">Ollama：</span>
        {!status?.enabled ? (
          <Tag>未启用</Tag>
        ) : status.reachable ? (
          <Tag color="green">可连接</Tag>
        ) : (
          <Tag color="red">不可达</Tag>
        )}
        {status?.reachable && <Tag color="blue">{status.models.length} 个模型</Tag>}
        {status?.vectorIndex?.indexedCount ? (
          <Tag color="purple">{status.vectorIndex.indexedCount} 个向量 chunk</Tag>
        ) : null}
        {status?.vectorIndex?.pendingCount ? (
          <Tag color="orange">{status.vectorIndex.pendingCount} 个待索引</Tag>
        ) : null}
        {status?.vectorIndex?.queuedCount ? (
          <Tag color="cyan">{status.vectorIndex.queuedCount} 个排队中</Tag>
        ) : null}
        {status?.vectorIndex?.activeCount ? (
          <Tag color="processing">{status.vectorIndex.activeCount} 个索引中</Tag>
        ) : null}
        {status?.error && <span className="text-red-500 text-xs">{status.error}</span>}
      </div>

      {settings.ollama.enabled && status?.reachable && !multilingualReady && (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          title="当前嵌入模型可能不是多语模型"
          description="跨语言检索建议使用 nomic-embed-text 或 bge-m3。"
        />
      )}

      {status?.vectorIndex?.reindexRequired && (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          title="向量索引需要重建"
          description="当前嵌入模型与已有索引不一致，请重新同步文档源以刷新语义检索索引。"
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={(values) =>
          onSave({
            ollama: {
              ...settings.ollama,
              ...values,
              queryTranslation: {
                ...settings.ollama.queryTranslation,
                ...values.queryTranslation
              },
              rerank: {
                ...settings.ollama.rerank,
                ...values.rerank
              }
            }
          })
        }
      >
        <Form.Item name="enabled" label="启用 Ollama" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item
          name="baseUrl"
          label="Base URL"
          rules={[
            { required: true, message: '请输入 Ollama 地址' },
            { type: 'url', message: '请输入有效 URL' }
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="embeddingModel" label="嵌入模型" rules={[{ required: true }]}>
          <AutoComplete options={modelOptions} filterOption />
        </Form.Item>
        <Form.Item
          name="embeddingConcurrency"
          label="向量索引并发"
          rules={[{ required: true, type: 'number', min: 1, max: 8 }]}
        >
          <InputNumber className="w-full" min={1} max={8} />
        </Form.Item>
        <Form.Item name="llmModel" label="小模型" rules={[{ required: true }]}>
          <AutoComplete options={modelOptions} filterOption />
        </Form.Item>
        <Form.Item
          name={['queryTranslation', 'enabled']}
          label="查询翻译增强"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item name={['rerank', 'enabled']} label="启用 Rerank" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name={['rerank', 'model']} label="Rerank 模型" rules={[{ required: true }]}>
          <AutoComplete options={modelOptions} filterOption />
        </Form.Item>
        <Form.Item
          name={['rerank', 'minScore']}
          label="Rerank minScore"
          rules={[{ required: true, type: 'number', min: 0, max: 1 }]}
        >
          <InputNumber className="w-full" min={0} max={1} step={0.05} />
        </Form.Item>
        <Form.Item
          name={['rerank', 'topK']}
          label="Rerank TopK"
          rules={[{ required: true, type: 'number', min: 1, max: 200 }]}
        >
          <InputNumber className="w-full" min={1} max={200} />
        </Form.Item>
        <div className="flex gap-2">
          <Button type="primary" htmlType="submit">
            保存
          </Button>
          <Button loading={isFetching} onClick={() => void refetch()}>
            刷新模型
          </Button>
        </div>
      </Form>
    </div>
  )
}
