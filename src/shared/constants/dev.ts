/** Developer shortcuts (dev build only) */
export const DEV_SHORTCUTS = {
  toggleDevTools: {
    mac: '⌥⌘I 或 F12',
    winLinux: 'Ctrl+Shift+I 或 F12',
    label: '切换 Chromium 开发者工具'
  },
  togglePanel: {
    mac: '⌘⇧D',
    winLinux: 'Ctrl+Shift+D',
    label: '切换 React / Router 调试面板'
  }
} as const
