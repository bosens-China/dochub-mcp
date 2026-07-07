import { mkdir, mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseAppConfig, type AppConfig } from '@shared/types/config'
import { ensureDataDirs } from '../../../config/load'
import { createCheckpoint } from '../persistence'
import { runConcurrentCrawl } from '../orchestrator'
import { createSourceRecord } from '../../source/store'

const fetchUrlMock = vi.hoisted(() => vi.fn())

vi.mock('../../crawler/fetcher', () => {
  return {
    fetchUrl: fetchUrlMock,
    sleep: vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }),
    computeRateDelay: vi.fn(() => 0),
    robotsCrawlDelay: vi.fn(() => null)
  }
})

function shellHtml(): string {
  return [
    '<!doctype html><html><head><title>Shell</title></head><body>',
    '<div id="app"></div>',
    '<script src="/a.js"></script><script src="/b.js"></script>',
    '<script src="/c.js"></script><script src="/d.js"></script>',
    '<script src="/e.js"></script>',
    '</body></html>'
  ].join('')
}

function renderedHtml(): string {
  return [
    '<!doctype html><html><head><title>Rendered</title></head><body><main>',
    '<h1>Rendered Docs</h1>',
    '<p>This rendered documentation page contains enough useful text after JavaScript runs.</p>',
    '<p>DocHub should persist this Playwright-rendered content instead of the empty shell.</p>',
    '</main></body></html>'
  ].join('')
}

describe('runConcurrentCrawl SPA fallback', () => {
  let dir: string | null = null

  afterEach(async () => {
    fetchUrlMock.mockReset()
    if (dir) {
      const cleanupDir = dir
      dir = null
      await rm(cleanupDir, { recursive: true, force: true })
    }
  })

  it('re-fetches short auto-mode pages with SPA rendering', async () => {
    dir = await mkdtemp(join(tmpdir(), 'dochub-spa-fallback-'))
    const config: AppConfig = parseAppConfig({
      dataDir: dir,
      crawl: { concurrency: 1 },
      spaDetection: { autoRetryMinMdChars: 200 }
    })
    await ensureDataDirs(config)

    const record = createSourceRecord({
      name: 'SPA Docs',
      seedUrl: 'https://example.com/docs/',
      crawlMode: 'auto'
    })
    await mkdir(join(dir, 'sources', record.id, 'docs'), { recursive: true })
    const url = 'https://example.com/docs/'
    const checkpoint = createCheckpoint(record.id, [url])

    fetchUrlMock.mockImplementation(async (_url: string, options: { crawlMode?: string }) => ({
      url,
      finalUrl: url,
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: options.crawlMode === 'spa' ? renderedHtml() : shellHtml()
    }))

    await runConcurrentCrawl({
      sourceId: record.id,
      config,
      record,
      crawl: { ...config.crawl, maxPages: null },
      fetchOpts: {
        crawl: config.crawl,
        crawlMode: 'auto',
        spaRender: config.spaRender
      },
      robotsTxt: null,
      checkpoint,
      onProgress: vi.fn()
    })

    expect(fetchUrlMock.mock.calls.map((call) => call[1]?.crawlMode)).toEqual(['auto', 'spa'])
    const written = await readFile(join(dir, 'sources', record.id, 'docs', 'index.md'), 'utf8')
    expect(written).toContain('Rendered Docs')
    expect(written).not.toContain('Shell')
  })
})
