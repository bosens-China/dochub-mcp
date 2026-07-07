import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseAppConfig } from '@shared/types/config'
import type { SearchResult } from '@shared/types'
import { rerankSearchResults } from '../rerank'

function mockJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function result(title: string): SearchResult {
  return {
    sourceId: 'source-a',
    sourceName: 'Source A',
    docPath: `docs/${title.toLowerCase()}.md`,
    title,
    snippet: `${title} snippet`,
    mode: 'hybrid'
  }
}

describe('rerankSearchResults', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('filters by minScore and uses the configured rerank model', async () => {
    const seenModels: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string }
        if (body.model) seenModels.push(body.model)
        return mockJsonResponse({
          message: {
            role: 'assistant',
            content: JSON.stringify({
              results: [
                { index: 0, score: 0.2 },
                { index: 1, score: 0.91 }
              ]
            })
          }
        })
      })
    )

    const config = parseAppConfig({
      ollama: {
        enabled: true,
        rerank: {
          enabled: true,
          model: 'reranker-model',
          minScore: 0.6
        }
      }
    }).ollama

    const results = await rerankSearchResults(
      'install plugin',
      [result('Low'), result('High')],
      config
    )

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ title: 'High', score: 0.91 })
    expect(seenModels).toEqual(['reranker-model'])
  })

  it('keeps original ordering when rerank output is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockJsonResponse({
          message: { role: 'assistant', content: 'not json' }
        })
      )
    )

    const config = parseAppConfig({
      ollama: {
        enabled: true,
        rerank: { enabled: true }
      }
    }).ollama
    const original = [result('First'), result('Second')]

    await expect(rerankSearchResults('query', original, config)).resolves.toEqual(original)
  })
})
