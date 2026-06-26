import { ReloadOutlined, RollbackOutlined, UndoOutlined } from '@ant-design/icons'
import { Button, Typography } from 'antd'

const { Paragraph, Text } = Typography

interface ErrorFallbackProps {
  title?: string
  error: Error
  onRetry: () => void
  onReload?: () => void
  onGoHome?: () => void
  showDetails?: boolean
}

export function ErrorFallback({
  title = '页面出现问题',
  error,
  onRetry,
  onReload,
  onGoHome,
  showDetails = import.meta.env.DEV
}: ErrorFallbackProps): React.JSX.Element {
  return (
    <div className="h-full flex items-center justify-center p-8 bg-archive-paper">
      <section className="archive-panel max-w-lg w-full p-8 text-center">
        <p className="archive-label m-0">异常</p>
        <h1 className="font-display text-xl text-archive-ink m-0 mt-2 font-semibold">{title}</h1>
        <Paragraph className="text-archive-muted mt-3 mb-0">
          应用遇到了意外错误，你可以重试当前页面，或重新加载窗口。
        </Paragraph>

        {showDetails && (
          <pre className="mt-4 mb-0 text-left text-xs font-mono bg-archive-shelf/50 border border-archive-line rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words text-archive-danger max-h-40 overflow-y-auto">
            {error.message}
          </pre>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <Button type="primary" icon={<UndoOutlined />} onClick={onRetry}>
            重试
          </Button>
          {onGoHome && (
            <Button icon={<RollbackOutlined />} onClick={onGoHome}>
              返回文档源
            </Button>
          )}
          {onReload && (
            <Button icon={<ReloadOutlined />} onClick={onReload}>
              重新加载
            </Button>
          )}
        </div>

        {!showDetails && (
          <Text type="secondary" className="block mt-4 text-xs">
            若问题持续出现，请尝试重新加载应用。
          </Text>
        )}
      </section>
    </div>
  )
}
