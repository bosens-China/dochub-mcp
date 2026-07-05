import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { readConfigSync } from '../config/sync-load'
import { sourceManager } from '../services/source/manager'
import { getMcpStatus } from '../services/mcp/lifecycle'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false
let trayRefreshTimer: ReturnType<typeof setInterval> | null = null

function trayIcon(): Electron.NativeImage {
  const image = nativeImage.createFromPath(icon)
  if (process.platform === 'darwin') {
    image.setTemplateImage(true)
  }
  return image
}

function syncStatusLabel(): string {
  const progress = sourceManager.getAnySyncProgress()
  if (progress) {
    return `${progress.message} (${progress.completed}/${progress.total})`
  }
  return '空闲'
}

function mcpStatusLabel(): string {
  const status = getMcpStatus()
  if (!status.enabled) return 'MCP：已关闭'
  if (status.listening) return `MCP：运行中 :${status.port}`
  return `MCP：未监听${status.error ? `（${status.error}）` : ''}`
}

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: '打开 DocHub',
      click: () => showMainWindow()
    },
    {
      label: `同步：${syncStatusLabel()}`,
      enabled: false
    },
    {
      label: mcpStatusLabel(),
      enabled: false
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
}

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window

  window.on('close', (event) => {
    if (isQuitting) return
    const { closeToTray } = readConfigSync().ui
    if (closeToTray) {
      event.preventDefault()
      window.hide()
      if (process.platform === 'darwin') {
        app.dock?.hide()
      }
    }
  })
}

export function showMainWindow(): void {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
  if (process.platform === 'darwin') {
    app.dock?.show()
  }
}

export function createTray(): Tray {
  if (tray) return tray

  tray = new Tray(trayIcon())
  tray.setToolTip('DocHub')
  tray.setContextMenu(buildMenu())

  tray.on('click', () => {
    showMainWindow()
  })

  trayRefreshTimer = setInterval(() => {
    tray?.setContextMenu(buildMenu())
  }, 5000)

  return tray
}

export function destroyTray(): void {
  if (trayRefreshTimer !== null) {
    clearInterval(trayRefreshTimer)
    trayRefreshTimer = null
  }
  tray?.destroy()
  tray = null
}

app.on('before-quit', () => {
  isQuitting = true
})
