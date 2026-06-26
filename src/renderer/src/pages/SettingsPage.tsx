import { useEffect } from 'react'
import { Alert, Button, Form, Input, InputNumber, Select, Switch, Tabs, App } from 'antd'
import { ApiOutlined, CloudDownloadOutlined, DesktopOutlined } from '@ant-design/icons'
import { MCP_DEFAULT_PORT } from '@shared/constants/mcp'
import type { AppSettings } from '@shared/types'
import { useSettings, useTestMcpConnection, useUpdateSettings } from '@renderer/hooks/use-app-data'

function GeneralTab({
  settings,
  onSave
}: {
  settings: AppSettings
  onSave: (values: Partial<AppSettings>) => void
}): React.JSX.Element {
  const [form] = Form.useForm<{ dataDir: string; closeToTray: boolean }>()

  useEffect(() => {
    form.setFieldsValue({
      dataDir: settings.dataDir,
      closeToTray: settings.ui.closeToTray
    })
  }, [form, settings])

  return (
    <Form
      form={form}
      layout="vertical"
      className="max-w-lg"
      onFinish={(values) =>
        onSave({ dataDir: values.dataDir, ui: { ...settings.ui, closeToTray: values.closeToTray } })
      }
    >
      <Form.Item name="dataDir" label="数据目录" extra="文档镜像与索引的存储位置">
        <Input prefix={<DesktopOutlined />} />
      </Form.Item>
      <Form.Item name="closeToTray" label="关闭窗口时最小化到托盘" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Button type="primary" htmlType="submit">
        保存
      </Button>
    </Form>
  )
}

function McpTab({
  settings,
  onSave
}: {
  settings: AppSettings
  onSave: (values: Partial<AppSettings>) => void
}): React.JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm<{
    enabled: boolean
    host: string
    port: number
    autoStart: boolean
  }>()
  const testMutation = useTestMcpConnection()

  useEffect(() => {
    form.setFieldsValue(settings.mcp)
  }, [form, settings.mcp])

  const handleTest = async (): Promise<void> => {
    const { host, port } = form.getFieldsValue()
    const ok = await testMutation.mutateAsync({ host, port })
    if (ok) {
      message.success('MCP 服务连接正常')
    } else {
      message.error('无法连接 MCP 服务，请检查端口与开关状态')
    }
  }

  return (
    <div className="max-w-lg">
      <Alert
        type="info"
        showIcon
        icon={<ApiOutlined />}
        className="mb-6"
        title="MCP 供 Cursor 等 AI 编辑器读取本地文档"
        description="关闭后不影响本地爬取与浏览，仅外部 Host 无法连接。"
      />
      <Form form={form} layout="vertical" onFinish={(values) => onSave({ mcp: values })}>
        <Form.Item name="enabled" label="启用 MCP 服务" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="host" label="绑定地址" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="port"
          label="端口"
          rules={[{ required: true, type: 'number', min: 1024, max: 65535 }]}
        >
          <InputNumber className="w-full" placeholder={String(MCP_DEFAULT_PORT)} />
        </Form.Item>
        <Form.Item name="autoStart" label="应用启动时自动开启" valuePropName="checked">
          <Switch />
        </Form.Item>
        <div className="flex gap-2">
          <Button type="primary" htmlType="submit">
            保存
          </Button>
          <Button loading={testMutation.isPending} onClick={() => void handleTest()}>
            测试连接
          </Button>
        </div>
      </Form>
    </div>
  )
}

function CrawlTab({
  settings,
  onSave
}: {
  settings: AppSettings
  onSave: (values: Partial<AppSettings>) => void
}): React.JSX.Element {
  const [form] = Form.useForm<AppSettings['crawl']>()

  useEffect(() => {
    form.setFieldsValue(settings.crawl)
  }, [form, settings.crawl])

  return (
    <Form
      form={form}
      layout="vertical"
      className="max-w-lg"
      onFinish={(values) =>
        onSave({
          crawl: {
            ...values,
            rateLimitMode: values.rateLimitMode,
            rateLimitFixedMs: values.rateLimitFixedMs,
            rateLimitRandomMinMs: values.rateLimitRandomMinMs,
            rateLimitRandomMaxMs: values.rateLimitRandomMaxMs
          }
        })
      }
    >
      <Form.Item name="respectRobots" label="遵守 robots.txt" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item
        name="concurrency"
        label="并发数"
        rules={[{ required: true, type: 'number', min: 1, max: 10 }]}
      >
        <InputNumber className="w-full" />
      </Form.Item>
      <Form.Item name="rateLimitMode" label="请求间隔模式">
        <Select
          options={[
            { value: 'fixed', label: '固定间隔' },
            { value: 'random', label: '随机间隔' }
          ]}
        />
      </Form.Item>
      <Form.Item name="rateLimitFixedMs" label="固定间隔 (ms)">
        <InputNumber className="w-full" min={0} step={100} />
      </Form.Item>
      <Form.Item name="rateLimitRandomMinMs" label="随机间隔最小 (ms)">
        <InputNumber className="w-full" min={0} step={100} />
      </Form.Item>
      <Form.Item name="rateLimitRandomMaxMs" label="随机间隔最大 (ms)">
        <InputNumber className="w-full" min={0} step={100} />
      </Form.Item>
      <Form.Item name="requestTimeoutMs" label="请求超时 (ms)">
        <InputNumber className="w-full" step={1000} />
      </Form.Item>
      <Form.Item name="userAgent" label="User-Agent">
        <Input />
      </Form.Item>
      <Button type="primary" htmlType="submit" icon={<CloudDownloadOutlined />}>
        保存
      </Button>
    </Form>
  )
}

export function SettingsPage(): React.JSX.Element {
  const { message } = App.useApp()
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()

  const handleSave = async (partial: Partial<AppSettings>): Promise<void> => {
    await updateMutation.mutateAsync(partial)
    message.success('设置已保存')
  }

  if (isLoading || !settings) {
    return <p className="p-8 text-archive-muted">加载设置…</p>
  }

  const tabItems = [
    {
      key: 'general',
      label: '通用',
      children: <GeneralTab settings={settings} onSave={(v) => void handleSave(v)} />
    },
    {
      key: 'mcp',
      label: 'MCP',
      children: <McpTab settings={settings} onSave={(v) => void handleSave(v)} />
    },
    {
      key: 'crawl',
      label: '爬取',
      children: <CrawlTab settings={settings} onSave={(v) => void handleSave(v)} />
    }
  ]

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 px-8 pt-8 pb-4 border-b border-archive-line">
        <p className="archive-label m-0">配置</p>
        <h1 className="font-display text-2xl text-archive-ink m-0 mt-1 font-semibold">设置</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <Tabs items={tabItems} />
      </div>
    </div>
  )
}
