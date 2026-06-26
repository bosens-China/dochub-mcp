import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { readConfigSync } from '../config/sync-load'
import { sourceManager } from '../services/source/manager'

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

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: '打开 DocHub',
      click: () => showMainWindow()
    },
    {
      label: syncStatusLabel(),
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
