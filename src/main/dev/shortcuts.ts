import { type BrowserWindow, type Input } from 'electron'
import { is } from '@electron-toolkit/utils'
import { IPC_EVENTS } from '@shared/ipc/events'

function isToggleDevTools(input: Input): boolean {
  if (input.code === 'F12') return true
  if (input.code !== 'KeyI') return false
  if (process.platform === 'darwin') {
    return input.meta && input.alt
  }
  return input.control && input.shift
}

function isToggleDevPanel(input: Input): boolean {
  if (input.code !== 'KeyD') return false
  if (process.platform === 'darwin') {
    return input.meta && input.shift
  }
  return input.control && input.shift
}

function toggleDevTools(window: BrowserWindow): void {
  const { webContents } = window
  if (webContents.isDevToolsOpened()) {
    webContents.closeDevTools()
  } else {
    webContents.openDevTools({ mode: 'undocked' })
  }
}

export function registerDeveloperShortcuts(window: BrowserWindow): void {
  if (!is.dev) return

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    if (isToggleDevTools(input)) {
      event.preventDefault()
      toggleDevTools(window)
      return
    }

    if (isToggleDevPanel(input)) {
      event.preventDefault()
      window.webContents.send(IPC_EVENTS.dev.togglePanel)
    }
  })
}
