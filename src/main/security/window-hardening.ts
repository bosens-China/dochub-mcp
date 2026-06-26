import { app, session, type BrowserWindow, type WebContents } from 'electron'
import { buildContentSecurityPolicy } from './content-security-policy'
import { isAllowedInAppNavigation, openExternalIfSafe } from './external-url'

export function applySessionContentSecurityPolicy(dev: boolean): void {
  const policy = buildContentSecurityPolicy(dev)

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') {
      callback({ responseHeaders: details.responseHeaders })
      return
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy]
      }
    })
  })
}

export function hardenWebContents(
  contents: WebContents,
  options: { devRendererOrigin: string | null }
): void {
  contents.on('will-navigate', (event, url) => {
    if (isAllowedInAppNavigation(url, options.devRendererOrigin)) return

    event.preventDefault()
    void openExternalIfSafe(url)
  })

  contents.setWindowOpenHandler(({ url }) => {
    void openExternalIfSafe(url)
    return { action: 'deny' }
  })
}

export function hardenBrowserWindow(
  window: BrowserWindow,
  options: { devRendererOrigin: string | null }
): void {
  hardenWebContents(window.webContents, options)
}

export function registerAppSecurityHandlers(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })
}
