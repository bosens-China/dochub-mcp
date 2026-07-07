import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseAppConfig, type AppConfig } from '@shared/types/config'
import { ensureDataDirs } from '../../../config/load'
import { closeFts, indexDocument } from '../../indexer/fts'
import { createSourceRecord, writeSourceRecord } from '../store'
import { SourceManager } from '../manager'

function mockJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function setManagerConfig(manager: SourceManager, config: AppConfig): void {
  ;(manager as unknown as { config: AppConfig }).config = config
}

describe('SourceManager search', () => {
  let dir: string | null = null

  afterEach(async (): Promise<void> => {
    vi.unstubAllGlobals()
    closeFts()
    if (dir) {
      const cleanupDir = dir
      dir = null
      await rm(cleanupDir, { recursive: true, force: true })
    }
  })

  it('uses query translation before keyword search', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'dochub-search-translation-'))
    dir = tempDir
    const config = parseAppConfig({
      dataDir: tempDir,
      ollama: {
        enabled: true,
        baseUrl: 'http://ollama.local',
        queryTranslation: { enabled: true }
      }
    })
    await ensureDataDirs(config)

    const record = createSourceRecord({
      name: 'English Docs',
      seedUrl: 'https://example.com/docs/',
      crawlMode: 'ssr'
    })
    await writeSourceRecord(record, config)

    const content = 'Install plugins with pnpm before running the app.'
    indexDocument(
      record.id,
      'docs/install.md',
      'Install',
      'hash-install',
      [{ chunkId: 0, content, charStart: 0, charEnd: content.length }],
      config
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mockJsonResponse({
          message: {
            role: 'assistant',
            content: JSON.stringify({ queries: ['install plugins'] })
          }
        })
      )
    )

    const manager = new SourceManager()
    setManagerConfig(manager, config)
    const results = await manager.searchDocuments('安装插件', null, 'keyword', 10)

    expect(results[0]).toMatchObject({
      sourceId: record.id,
      sourceName: 'English Docs',
      docPath: 'docs/install.md',
      mode: 'keyword'
    })
  })

  it('falls back to keyword search when Ollama is unreachable', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'dochub-search-fallback-'))
    dir = tempDir
    const config = parseAppConfig({
      dataDir: tempDir,
      ollama: {
        enabled: true,
        baseUrl: 'http://ollama.local',
        embeddingModel: 'test-embed'
      }
    })
    await ensureDataDirs(config)

    const record = createSourceRecord({
      name: 'Fallback Docs',
      seedUrl: 'https://example.com/docs/',
      crawlMode: 'ssr'
    })
    await writeSourceRecord(record, config)

    const content = 'Install the local documentation search service.'
    indexDocument(
      record.id,
      'docs/search.md',
      'Search',
      'hash-search',
      [{ chunkId: 0, content, charStart: 0, charEnd: content.length }],
      config
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    const manager = new SourceManager()
    setManagerConfig(manager, config)
    const results = await manager.searchDocuments('documentation search', null, 'semantic', 10)

    expect(results[0]).toMatchObject({
      sourceId: record.id,
      sourceName: 'Fallback Docs',
      docPath: 'docs/search.md',
      mode: 'keyword'
    })
  })
})
