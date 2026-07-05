import { AppLogPanel } from '@renderer/components/sync/AppLogPanel'
import { SyncLogTabs } from '@renderer/components/sync/SyncLogTabs'
import { SyncProgressPanel } from '@renderer/components/sync/SyncProgressPanel'
import { useAppLogs, useSources, useSyncLogs, useSyncProgress } from '@renderer/hooks/use-app-data'

export function SyncPage(): React.JSX.Element {
  const { data: progressList = [] } = useSyncProgress()
  const { data: logs = [], isLoading } = useSyncLogs()
  const { data: appLogs = [], isLoading: appLogsLoading } = useAppLogs()
  const { data: sources = [] } = useSources()

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 px-8 pt-8 pb-4 border-b border-archive-line">
        <p className="archive-label m-0">活动</p>
        <h1 className="font-display text-2xl text-archive-ink m-0 mt-1 font-semibold">同步</h1>
        <p className="text-archive-muted text-sm mt-2 mb-0">查看当前抓取进度与历史日志。</p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        <SyncProgressPanel progressList={progressList} sources={sources} />

        <section>
          <h2 className="font-display text-lg text-archive-ink mb-4 mt-0">同步日志</h2>
          <div className="archive-panel p-4">
            <SyncLogTabs logs={logs} sources={sources} isLoading={isLoading} />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg text-archive-ink mb-4 mt-0">应用日志</h2>
          <div className="archive-panel p-4">
            <AppLogPanel logs={appLogs} isLoading={appLogsLoading} />
          </div>
        </section>
      </div>
    </div>
  )
}
