import { Outlet, useRouter } from '@tanstack/react-router'
import { AppErrorBoundary } from '@renderer/components/AppErrorBoundary'
import { NavSpine } from '@renderer/components/layout/NavSpine'

interface AppShellProps {
  children?: React.ReactNode
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const router = useRouter()

  return (
    <div className="h-screen flex bg-archive-paper overflow-hidden">
      <aside className="w-52 shrink-0 border-r border-archive-line bg-archive-shelf/40 flex flex-col">
        <NavSpine />
        <div className="mt-auto px-4 py-4 border-t border-archive-line">
          <p className="text-xs text-archive-muted m-0 leading-relaxed">
            数据存于本地
            <br />
            <span className="font-mono text-archive-teal">~/dochub</span>
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppErrorBoundary
          title="当前页面出现问题"
          onGoHome={() => {
            void router.navigate({ to: '/sources' })
          }}
        >
          {children ?? <Outlet />}
        </AppErrorBoundary>
      </main>
    </div>
  )
}
