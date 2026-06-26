import { describe, expect, it } from 'vitest'
import { parseAppConfig } from '@shared/types/config'
import { discoverSeedUrls } from '../../discovery/index'

describe('discoverSeedUrls', () => {
  it(
    'includes seed URL in scope',
    async () => {
      const crawl = parseAppConfig({}).crawl
      const urls = await discoverSeedUrls(
        'https://electron-vite.org/guide/',
        '/guide/',
        crawl,
        {}
      )
      expect(urls.length).toBeGreaterThan(0)
      expect(urls).toContain('https://electron-vite.org/guide/')
    },
    30_000
  )
})
