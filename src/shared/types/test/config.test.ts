import { describe, expect, it } from 'vitest'
import { parseAppConfig } from '../config'

describe('parseAppConfig', () => {
  it('fills ollama defaults for existing v1 configs', () => {
    const config = parseAppConfig({
      dataDir: '~/dochub',
      crawl: {
        concurrency: 2
      }
    })

    expect(config.ollama).toMatchObject({
      enabled: false,
      baseUrl: 'http://127.0.0.1:11434',
      embeddingModel: 'nomic-embed-text',
      embeddingConcurrency: 2,
      llmModel: 'qwen2.5:3b',
      queryTranslation: { enabled: false },
      rerank: {
        enabled: false,
        model: 'bge-reranker-v2-m3',
        minScore: 0.6,
        topK: 20
      }
    })
    expect(config.spaDetection).toMatchObject({
      alwaysConfirm: false,
      autoRetryMinMdChars: 200
    })
    expect(config.spaRender).toMatchObject({
      timeoutMs: 30000,
      waitUntil: 'networkidle',
      settleMs: 500,
      maxPages: 3
    })
  })

  it('deep-merges ollama nested config', () => {
    const config = parseAppConfig({
      ollama: {
        enabled: true,
        rerank: {
          enabled: true,
          minScore: 0.75
        }
      }
    })

    expect(config.ollama.rerank).toMatchObject({
      enabled: true,
      model: 'bge-reranker-v2-m3',
      minScore: 0.75,
      topK: 20
    })
  })
})
