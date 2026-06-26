import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { ErrorFallback } from '@renderer/components/ErrorFallback'

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  return new Error(typeof value === 'string' ? value : '未知错误')
}

export function RouteErrorFallback({ error, reset }: ErrorComponentProps): React.JSX.Element {
  const router = useRouter()

  return (
    <ErrorFallback
      title="页面加载失败"
      error={toError(error)}
      onRetry={reset}
      onReload={() => window.location.reload()}
      onGoHome={() => {
        reset()
        void router.navigate({ to: '/sources' })
      }}
    />
  )
}
