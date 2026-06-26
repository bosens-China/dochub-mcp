import '@fontsource/literata/400.css'
import '@fontsource/literata/600.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import 'virtual:uno.css'
import './assets/global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router'
import { App, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { DeveloperPanels } from '@renderer/components/DeveloperPanels'
import { AppErrorBoundary } from '@renderer/components/AppErrorBoundary'
import { queryClient } from '@renderer/lib/query-client'
import { appTheme } from '@renderer/lib/theme'
import { routeTree } from '@renderer/routeTree.gen'

const hashHistory = createHashHistory()

const router = createRouter({
  routeTree,
  history: hashHistory,
  defaultPreload: 'intent',
  context: { queryClient }
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={appTheme}>
        <App>
          <AppErrorBoundary title="应用出现问题">
            <RouterProvider router={router} />
            <DeveloperPanels router={router} />
          </AppErrorBoundary>
        </App>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>
)
