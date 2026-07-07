import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

if (process.env['DOCHUB_SKIP_PLAYWRIGHT_INSTALL'] === '1') {
  process.exit(0)
}

const require = createRequire(import.meta.url)
const packageJsonPath = require.resolve('playwright/package.json')
const cliPath = join(dirname(packageJsonPath), 'cli.js')
const result = spawnSync(process.execPath, [cliPath, 'install', 'chromium', '--no-shell'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: '0'
  }
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
