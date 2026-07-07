import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAppConfig, type AppConfig } from '@shared/types/config'
import type { Chunk } from '../chunker'
import { closeVectorIndex, getVectorIndexState } from '../vector'
import {
  cancelDocumentVectorIndex,
  enqueueDocumentVectorIndex,
  getVectorQueueState,
  waitForVectorQueueIdle
} from '../vector-queue'

function mockJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function makeChunk(id: number, content: string): Chunk {
  return {
    chunkId: id,
    content,
    charStart: 0,
    charEnd: content.length
  }
}

function embeddingFor(text: string): number[] {
  return text.includes('second') ? [0, 1] : [1, 0]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('vector queue', () => {
  let dir: string
  let config: AppConfig

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dochub-vector-queue-'))
    config = parseAppConfig({
      dataDir: dir,
      ollama: {
        enabled: true,
        baseUrl: 'http://ollama.local',
        embeddingModel: 'test-embed',
        embeddingConcurrency: 1
      }
    })
  })

  afterEach(async () => {
    await waitForVectorQueueIdle(1_000).catch(() => undefined)
    vi.unstubAllGlobals()
    closeVectorIndex()
    await rm(dir, { recursive: true, force: true })
  })

  it('indexes queued documents with configured concurrency', async () => {
    let activeRequests = 0
    let maxActiveRequests = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        activeRequests += 1
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
        await sleep(20)
        const body = JSON.parse(String(init?.body ?? '{}')) as { input?: unknown }
        const input = body.input
        activeRequests -= 1
        if (Array.isArray(input) && input.every((item) => typeof item === 'string')) {
          return mockJsonResponse({ embeddings: input.map((item) => embeddingFor(item)) })
        }
        return mockJsonResponse({ embeddings: [] })
      })
    )

    enqueueDocumentVectorIndex(
      'queue-source',
      'docs/first.md',
      'First',
      'hash-first',
      [makeChunk(0, 'first document')],
      config
    )
    enqueueDocumentVectorIndex(
      'queue-source',
      'docs/second.md',
      'Second',
      'hash-second',
      [makeChunk(0, 'second document')],
      config
    )

    expect(getVectorQueueState(config)).toMatchObject({ concurrency: 1 })
    await waitForVectorQueueIdle()

    expect(maxActiveRequests).toBe(1)
    expect(getVectorIndexState(config)).toMatchObject({
      indexedCount: 2,
      pendingCount: 0
    })
  })

  it('does not write vectors for cancelled documents', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        await sleep(20)
        const body = JSON.parse(String(init?.body ?? '{}')) as { input?: unknown }
        const input = body.input
        if (Array.isArray(input) && input.every((item) => typeof item === 'string')) {
          return mockJsonResponse({ embeddings: input.map((item) => embeddingFor(item)) })
        }
        return mockJsonResponse({ embeddings: [] })
      })
    )

    enqueueDocumentVectorIndex(
      'cancel-source',
      'docs/cancelled.md',
      'Cancelled',
      'hash-cancelled',
      [makeChunk(0, 'cancelled document')],
      config
    )
    cancelDocumentVectorIndex('cancel-source', 'docs/cancelled.md')

    await waitForVectorQueueIdle()

    expect(getVectorIndexState(config)).toMatchObject({
      indexedCount: 0,
      pendingCount: 0
    })
  })
})
