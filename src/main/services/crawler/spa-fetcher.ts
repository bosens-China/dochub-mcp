import { BrowserWindow, app } from 'electron'
import type { FetchResult } from './fetcher'

function formatExtraHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([key]) => key.toLowerCase() !== 'user-agent')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

export async function fetchSpaHtml(
  url: string,
  timeoutMs: number,
  userAgent: string,
  headers: Record<string, string> = {}
): Promise<FetchResult> {
  await app.whenReady()

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 阻止弹窗
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.setUserAgent(userAgent)

  let status = 200
  win.webContents.on('did-navigate', (_event, _navUrl, httpResponseCode) => {
    if (httpResponseCode >= 100) {
      status = httpResponseCode
    }
  })

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.stop()
        win.destroy()
      }
      reject(new Error(`SPA Fetch Timeout: ${url}`))
    }, timeoutMs)

    win
      .loadURL(url, { extraHeaders: formatExtraHeaders(headers) })
      .then(() => {
        // 等待框架完成挂载
        setTimeout(async () => {
          try {
            if (win.isDestroyed()) return
            const finalUrl = win.webContents.getURL()
            const html = await win.webContents.executeJavaScript(
              'document.documentElement.outerHTML'
            )
            clearTimeout(timer)
            win.destroy()
            resolve({
              url,
              finalUrl,
              status,
              headers: { 'content-type': 'text/html' },
              body: html
            })
          } catch (e) {
            clearTimeout(timer)
            if (!win.isDestroyed()) win.destroy()
            reject(e)
          }
        }, 2000)
      })
      .catch((e) => {
        clearTimeout(timer)
        if (!win.isDestroyed()) win.destroy()
        reject(e)
      })
  })
}
