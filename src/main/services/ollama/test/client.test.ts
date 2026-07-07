import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseAppConfig } from '@shared/types/config'
import { chatWithOllama, embedWithOllama, getOllamaStatus, listOllamaModels } from '../client'

function mockJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

describe('ollama client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists models from /api/tags', async () => {
    const fetchMock = vi.fn(async () =>
      mockJsonResponse({
        models: [
          { name: 'nomic-embed-text', modified_at: '2026-07-07T00:00:00Z', size: 1 },
          { model: 'qwen2.5:3b' }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const models = await listOllamaModels(parseAppConfig({}).ollama)

    expect(models.map((model) => model.name)).toEqual(['nomic-embed-text', 'qwen2.5:3b'])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('reports model availability in status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockJsonResponse({
          models: [{ name: 'nomic-embed-text' }, { name: 'qwen2.5:3b' }]
        })
      )
    )

    const status = await getOllamaStatus(
      parseAppConfig({
        ollama: { enabled: true, baseUrl: 'http://127.0.0.1:11434/' }
      }).ollama
    )

    expect(status).toMatchObject({
      enabled: true,
      reachable: true,
      baseUrl: 'http://127.0.0.1:11434',
      embeddingModelAvailable: true,
      llmModelAvailable: true
    })
  })

  it('returns unreachable status instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    const status = await getOllamaStatus(parseAppConfig({ ollama: { enabled: true } }).ollama)

    expect(status.reachable).toBe(false)
    expect(status.error).toBe('offline')
  })

  it('wraps /api/embed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockJsonResponse({ embeddings: [[0.1, 0.2]] }))
    )

    await expect(
      embedWithOllama(parseAppConfig({ ollama: { enabled: true } }).ollama, 'hello')
    ).resolves.toEqual([[0.1, 0.2]])
  })

  it('wraps /api/chat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockJsonResponse({ message: { role: 'assistant', content: '{"ok":true}' } })
      )
    )

    await expect(
      chatWithOllama(parseAppConfig({ ollama: { enabled: true } }).ollama, [
        { role: 'user', content: 'json' }
      ])
    ).resolves.toBe('{"ok":true}')
  })
})
