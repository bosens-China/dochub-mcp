import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '@renderer/components/AppErrorBoundary'

describe('AppErrorBoundary', () => {
  it('捕获子组件渲染错误，重试后恢复渲染', async () => {
    let shouldThrow = true

    function Child(): React.JSX.Element {
      if (shouldThrow) {
        throw new Error('测试渲染错误')
      }
      return <p>正常内容</p>
    }

    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <AppErrorBoundary>
        <Child />
      </AppErrorBoundary>
    )

    expect(screen.getByText('页面出现问题')).toBeInTheDocument()
    expect(screen.getByText('测试渲染错误')).toBeInTheDocument()

    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /重试/ }))

    expect(screen.getByText('正常内容')).toBeInTheDocument()

    consoleError.mockRestore()
  })
})
