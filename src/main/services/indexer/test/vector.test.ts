import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAppConfig, type AppConfig } from '@shared/types/config'
import type { Chunk } from '../chunker'
import {
  closeVectorIndex,
  getVectorIndexState,
  indexDocumentVectors,
  searchSemantic
} from '../vector'

function mockJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function embeddingFor(text: string): number[] {
  const normalized = text.toLowerCase()
  if (normalized.includes('apple')) return [1, 0]
  if (normalized.includes('banana')) return [0, 1]
  return [0.5, 0.5]
}

function makeChunk(id: number, content: string): Chunk {
  return {
    chunkId: id,
    content,
    charStart: 0,
    charEnd: content.length
  }
}

describe('vector indexer', () => {
  let dir: string
  let config: AppConfig

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dochub-vector-'))
    config = parseAppConfig({
      dataDir: dir,
      ollama: {
        enabled: true,
        baseUrl: 'http://ollama.local',
        embeddingModel: 'test-embed'
      }
    })
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    closeVectorIndex()
    await rm(dir, { recursive: true, force: true })
  })

  it('indexes changed chunks and searches nearest vectors', async () => {
    const embedInputs: Array<string | string[]> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { input?: unknown }
        const input = body.input
        if (typeof input === 'string') {
          embedInputs.push(input)
          return mockJsonResponse({ embeddings: [embeddingFor(input)] })
        }
        if (Array.isArray(input) && input.every((item) => typeof item === 'string')) {
          embedInputs.push(input)
          return mockJsonResponse({ embeddings: input.map((item) => embeddingFor(item)) })
        }
        return mockJsonResponse({ embeddings: [] })
      })
    )

    const apple = [makeChunk(0, 'Apple install guide')]
    const banana = [makeChunk(0, 'Banana config reference')]
    await expect(
      indexDocumentVectors('source-a', 'docs/apple.md', 'Apple', 'hash-apple', apple, config)
    ).resolves.toMatchObject({ status: 'indexed', indexed: 1 })
    await expect(
      indexDocumentVectors('source-a', 'docs/banana.md', 'Banana', 'hash-banana', banana, config)
    ).resolves.toMatchObject({ status: 'indexed', indexed: 1 })

    await indexDocumentVectors('source-a', 'docs/apple.md', 'Apple', 'hash-apple', apple, config)
    expect(embedInputs).toHaveLength(2)
    expect(getVectorIndexState(config)).toMatchObject({
      available: true,
      model: 'test-embed',
      dimension: 2,
      indexedCount: 2
    })

    const results = await searchSemantic('apple docs', 'source-a', config, 5)
    expect(results[0]).toMatchObject({
      sourceId: 'source-a',
      docPath: 'docs/apple.md',
      title: 'Apple'
    })
  })

  it('marks chunks pending when embedding fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ollama offline')
      })
    )

    const result = await indexDocumentVectors(
      'source-a',
      'docs/apple.md',
      'Apple',
      'hash-apple',
      [makeChunk(0, 'Apple install guide')],
      config
    )

    expect(result).toMatchObject({
      status: 'pending',
      pending: 1,
      error: 'ollama offline'
    })
    expect(getVectorIndexState(config)).toMatchObject({
      available: false,
      pendingCount: 1
    })
  })
})
