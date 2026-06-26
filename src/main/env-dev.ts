/** Dev-only: Vite HMR CSP uses unsafe-eval; Electron warns until packaged */
if (process.env['ELECTRON_RENDERER_URL']) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
}
