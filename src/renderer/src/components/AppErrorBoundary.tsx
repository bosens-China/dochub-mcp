import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorFallback } from '@renderer/components/ErrorFallback'

interface AppErrorBoundaryProps {
  children: ReactNode
  title?: string
  onGoHome?: () => void
}

interface AppErrorBoundaryState {
  hasError: boolean
  error: Error | null
  resetKey: number
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    error: null,
    resetKey: 0
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  private handleRetry = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1
    }))
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    const { hasError, error, resetKey } = this.state
    const { children, title, onGoHome } = this.props

    if (hasError && error) {
      return (
        <ErrorFallback
          title={title}
          error={error}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          onGoHome={onGoHome}
        />
      )
    }

    return <div key={resetKey} className="contents">
      {children}
    </div>
  }
}
