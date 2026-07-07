import { existsSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { createRequire } from 'module'
import { app } from 'electron'
import type { Browser, BrowserContext, LaunchOptions, Page } from 'playwright'
import type { SpaRenderConfig } from '@shared/types/config'
import type { FetchResult } from './fetcher'

const importPlaywright = Function('specifier', 'return import(specifier)') as unknown as (
  specifier: string
) => Promise<typeof import('playwright')>
const require = createRequire(import.meta.url)

function headersWithoutUserAgent(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'user-agent')
  )
}

function findBundledBrowserPath(): string | null {
  if (!app.isPackaged) return null

  const unpackedRoot = join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
  const direct = join(unpackedRoot, 'playwright-core', '.local-browsers')
  if (existsSync(direct)) return direct

  const pnpmRoot = join(unpackedRoot, '.pnpm')
  if (!existsSync(pnpmRoot)) return null

  for (const entry of readdirSync(pnpmRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('playwright-core@')) continue
    const candidate = join(
      pnpmRoot,
      entry.name,
      'node_modules',
      'playwright-core',
      '.local-browsers'
    )
    if (existsSync(candidate)) return candidate
  }
  return null
}

function configurePlaywrightBrowserPath(): void {
  if (process.env['PLAYWRIGHT_BROWSERS_PATH']) return

  const bundled = findBundledBrowserPath()
  if (bundled) {
    process.env['PLAYWRIGHT_BROWSERS_PATH'] = bundled
  }
}

function findPackageBrowserPath(): string | null {
  try {
    const packageJsonPath = require.resolve('playwright-core/package.json')
    return join(dirname(packageJsonPath), '.local-browsers')
  } catch {
    return null
  }
}

function browserPathCandidates(): string[] {
  const candidates: string[] = []
  const envPath = process.env['PLAYWRIGHT_BROWSERS_PATH']
  if (envPath && envPath !== '0') {
    candidates.push(envPath)
  }
  const bundled = findBundledBrowserPath()
  if (bundled) {
    candidates.push(bundled)
  }
  const packagePath = findPackageBrowserPath()
  if (packagePath) {
    candidates.push(packagePath)
  }
  return [...new Set(candidates)].filter((candidate) => existsSync(candidate))
}

function chromiumExecutableRelativePaths(): string[] {
  if (process.platform === 'win32') return [join('chrome-win64', 'chrome.exe')]
  if (process.platform === 'darwin') {
    return [join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')]
  }
  return [join('chrome-linux', 'chrome')]
}

function findChromiumExecutable(): string | null {
  for (const root of browserPathCandidates()) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('chromium-')) continue
      if (entry.name.startsWith('chromium_headless_shell-')) continue
      for (const relativePath of chromiumExecutableRelativePaths()) {
        const executable = join(root, entry.name, relativePath)
        if (existsSync(executable)) return executable
      }
    }
  }
  return null
}

class SpaBrowserPool {
  private browser: Browser | null = null
  private browserPromise: Promise<Browser> | null = null
  private activePages = 0
  private maxPages: number
  private readonly waiters: Array<() => void> = []

  constructor(maxPages: number) {
    this.maxPages = maxPages
  }

  setMaxPages(maxPages: number): void {
    this.maxPages = Math.max(1, Math.min(10, Math.floor(maxPages)))
    while (this.activePages < this.maxPages && this.waiters.length > 0) {
      this.activePages += 1
      this.waiters.shift()?.()
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser
    if (this.browserPromise) return this.browserPromise

    configurePlaywrightBrowserPath()
    this.browserPromise = importPlaywright('playwright').then(async ({ chromium }) => {
      const executablePath = findChromiumExecutable()
      const launchOptions: LaunchOptions = {
        headless: true,
        ...(executablePath ? { executablePath } : {})
      }
      const browser = await chromium.launch(launchOptions)
      browser.on('disconnected', () => {
        this.browser = null
        this.browserPromise = null
      })
      this.browser = browser
      return browser
    })
    return this.browserPromise
  }

  private async acquirePageSlot(): Promise<void> {
    if (this.activePages < this.maxPages) {
      this.activePages += 1
      return
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve)
    })
  }

  private releasePageSlot(): void {
    const next = this.waiters.shift()
    if (next) {
      next()
      return
    }
    this.activePages = Math.max(0, this.activePages - 1)
  }

  async render(
    url: string,
    render: SpaRenderConfig,
    userAgent: string,
    headers: Record<string, string>
  ): Promise<FetchResult> {
    await this.acquirePageSlot()
    let context: BrowserContext | null = null

    try {
      const browser = await this.getBrowser()
      context = await browser.newContext({
        userAgent,
        extraHTTPHeaders: headersWithoutUserAgent(headers)
      })
      const page: Page = await context.newPage()
      page.setDefaultTimeout(render.timeoutMs)
      const response = await page.goto(url, {
        waitUntil: render.waitUntil,
        timeout: render.timeoutMs
      })
      if (render.settleMs > 0) {
        await page.waitForTimeout(render.settleMs)
      }
      return {
        url,
        finalUrl: page.url(),
        status: response?.status() ?? 200,
        headers: response?.headers() ?? { 'content-type': 'text/html' },
        body: await page.content()
      }
    } finally {
      await context?.close().catch(() => undefined)
      this.releasePageSlot()
    }
  }

  async close(): Promise<void> {
    const browser = this.browser ?? (await this.browserPromise?.catch(() => null))
    this.browser = null
    this.browserPromise = null
    this.waiters.splice(0).forEach((resolve) => resolve())
    this.activePages = 0
    await browser?.close().catch(() => undefined)
  }
}

let browserPool: SpaBrowserPool | null = null

function getBrowserPool(maxPages: number): SpaBrowserPool {
  if (!browserPool) {
    browserPool = new SpaBrowserPool(maxPages)
  }
  browserPool.setMaxPages(maxPages)
  return browserPool
}

export async function fetchSpaHtml(
  url: string,
  render: SpaRenderConfig,
  userAgent: string,
  headers: Record<string, string> = {}
): Promise<FetchResult> {
  await app.whenReady()
  return getBrowserPool(render.maxPages).render(url, render, userAgent, headers)
}

export async function closeSpaBrowserPool(): Promise<void> {
  await browserPool?.close()
  browserPool = null
}
