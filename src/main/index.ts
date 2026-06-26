import './env-dev'
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc/register-handlers'
import {
  applySessionContentSecurityPolicy,
  hardenBrowserWindow,
  registerAppSecurityHandlers
} from './security/window-hardening'
import { registerDeveloperShortcuts } from './dev/shortcuts'
import { createTray, setMainWindow } from './tray'

function devRendererOrigin(): string | null {
  if (!is.dev) return null
  return process.env['ELECTRON_RENDERER_URL'] ?? null
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  })

  setMainWindow(mainWindow)
  hardenBrowserWindow(mainWindow, { devRendererOrigin: devRendererOrigin() })
  registerDeveloperShortcuts(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

registerAppSecurityHandlers()

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  applySessionContentSecurityPolicy(is.dev)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await registerIpcHandlers()

  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      BrowserWindow.getAllWindows()[0]?.show()
    }
  })
})

app.on('window-all-closed', () => {
  // 托盘常驻：非 macOS 也不自动退出
})
