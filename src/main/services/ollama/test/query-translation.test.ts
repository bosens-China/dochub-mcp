import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseAppConfig } from '@shared/types/config'
import { buildTranslatedSearchQueries } from '../query-translation'

function mockJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function enabledConfig(): ReturnType<typeof parseAppConfig>['ollama'] {
  return parseAppConfig({
    ollama: {
      enabled: true,
      baseUrl: 'http://ollama.local',
      queryTranslation: { enabled: true }
    }
  }).ollama
}

describe('query translation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds translated queries and keeps the original query first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockJsonResponse({
          message: {
            role: 'assistant',
            content: JSON.stringify({
              queries: ['安装 插件', 'install plugin', 'plugin setup']
            })
          }
        })
      )
    )

    await expect(buildTranslatedSearchQueries(' 安装   插件 ', enabledConfig())).resolves.toEqual([
      '安装 插件',
      'install plugin',
      'plugin setup'
    ])
  })

  it('skips translation when disabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const config = parseAppConfig({
      ollama: {
        enabled: true,
        queryTranslation: { enabled: false }
      }
    }).ollama

    await expect(buildTranslatedSearchQueries('安装 插件', config)).resolves.toEqual(['安装 插件'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to the original query when Ollama fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    await expect(buildTranslatedSearchQueries('安装 插件', enabledConfig())).resolves.toEqual([
      '安装 插件'
    ])
  })
})
