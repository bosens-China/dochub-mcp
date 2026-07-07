import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAppConfig } from '@shared/types/config'
import { discoverSeedUrls } from '../../discovery/index'
import { clearDomainCache } from '../domain-cache'

function response(text: string, ok = true): Response {
  return new Response(text, { status: ok ? 200 : 404 })
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function hrefFromFetchInput(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

describe('discoverSeedUrls', () => {
  beforeEach(() => {
    clearDomainCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearDomainCache()
  })

  it('includes seed URL in scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url)
        if (href.endsWith('/llms-full.txt')) return response('', false)
        if (href.endsWith('/llms.txt')) {
          return response('[Install](https://electron-vite.org/guide/install)')
        }
        if (href.endsWith('/sitemap.xml')) {
          return response(
            '<urlset><url><loc>https://electron-vite.org/guide/build</loc></url></urlset>'
          )
        }
        return response('', false)
      })
    )

    const crawl = parseAppConfig({}).crawl
    const urls = await discoverSeedUrls('https://electron-vite.org/guide/', '/guide/', crawl, {})
    expect(urls).toEqual([
      'https://electron-vite.org/guide/',
      'https://electron-vite.org/guide/install',
      'https://electron-vite.org/guide/build'
    ])
  })

  it('uses Ollama to structure unparseable llms.txt and filters by scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const href = hrefFromFetchInput(url)
        if (href.endsWith('/llms-full.txt')) return response('', false)
        if (href.endsWith('/llms.txt')) {
          return response('The guide includes install notes and a separate blog announcement.')
        }
        if (href.endsWith('/sitemap.xml')) return response('', false)
        if (href === 'http://ollama.local/api/chat') {
          return jsonResponse({
            message: {
              role: 'assistant',
              content: JSON.stringify([
                { url: 'https://electron-vite.org/guide/llm-found' },
                { url: 'https://electron-vite.org/blog/out-of-scope' }
              ])
            }
          })
        }
        return response('', false)
      })
    )

    const config = parseAppConfig({
      ollama: {
        enabled: true,
        baseUrl: 'http://ollama.local'
      }
    })
    const urls = await discoverSeedUrls(
      'https://electron-vite.org/guide/',
      '/guide/',
      config.crawl,
      {},
      undefined,
      config.ollama
    )

    expect(urls).toEqual([
      'https://electron-vite.org/guide/',
      'https://electron-vite.org/guide/llm-found'
    ])
  })

  it('skips Ollama structure pass when Ollama is disabled', async () => {
    const fetched: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const href = hrefFromFetchInput(url)
        fetched.push(href)
        if (href.endsWith('/llms-full.txt')) return response('', false)
        if (href.endsWith('/llms.txt')) return response('Install notes without raw URLs.')
        if (href.endsWith('/sitemap.xml')) return response('', false)
        return response('', false)
      })
    )

    const config = parseAppConfig({
      ollama: {
        enabled: false,
        baseUrl: 'http://ollama.local'
      }
    })
    const urls = await discoverSeedUrls(
      'https://electron-vite.org/guide/',
      '/guide/',
      config.crawl,
      {},
      undefined,
      config.ollama
    )

    expect(urls).toEqual(['https://electron-vite.org/guide/'])
    expect(fetched).not.toContain('http://ollama.local/api/chat')
  })
})
