import { z } from 'zod'
import type { OllamaConfig } from '@shared/types/config'
import type { OllamaModel, OllamaStatus, OllamaVectorIndexStatus } from '@shared/types'

const OLLAMA_TIMEOUT_MS = 5_000

const TagsResponseSchema = z.object({
  models: z
    .array(
      z.object({
        name: z.string().optional(),
        model: z.string().optional(),
        modified_at: z.string().optional(),
        size: z.number().optional(),
        digest: z.string().optional()
      })
    )
    .default([])
})

const EmbedResponseSchema = z
  .object({
    embeddings: z.array(z.array(z.number())).optional(),
    embedding: z.array(z.number()).optional()
  })
  .transform((value) => {
    if (value.embeddings) return value.embeddings
    if (value.embedding) return [value.embedding]
    return []
  })

const ChatResponseSchema = z.object({
  message: z.object({
    role: z.string(),
    content: z.string()
  })
})

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OllamaChatOptions {
  format?: 'json'
  model?: string
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

async function fetchJson(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = OLLAMA_TIMEOUT_MS
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init.headers
      },
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`)
    }
    return (await response.json()) as unknown
  } finally {
    clearTimeout(timer)
  }
}

export async function listOllamaModels(config: OllamaConfig): Promise<OllamaModel[]> {
  const raw = await fetchJson(config.baseUrl, '/api/tags')
  const parsed = TagsResponseSchema.parse(raw)

  return parsed.models
    .map((model) => ({
      name: model.name ?? model.model ?? '',
      modifiedAt: model.modified_at,
      size: model.size,
      digest: model.digest
    }))
    .filter((model) => model.name.length > 0)
}

export async function embedWithOllama(
  config: OllamaConfig,
  input: string | string[]
): Promise<number[][]> {
  if (!config.enabled) {
    throw new Error('Ollama 未启用')
  }
  const raw = await fetchJson(config.baseUrl, '/api/embed', {
    method: 'POST',
    body: JSON.stringify({
      model: config.embeddingModel,
      input
    })
  })
  const embeddings = EmbedResponseSchema.parse(raw)
  if (embeddings.length === 0) {
    throw new Error('Ollama embed 返回为空')
  }
  return embeddings
}

export async function chatWithOllama(
  config: OllamaConfig,
  messages: OllamaChatMessage[],
  options: OllamaChatOptions = {}
): Promise<string> {
  if (!config.enabled) {
    throw new Error('Ollama 未启用')
  }
  const raw = await fetchJson(config.baseUrl, '/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model: options.model ?? config.llmModel,
      messages,
      stream: false,
      ...(options.format ? { format: options.format } : {})
    })
  })
  return ChatResponseSchema.parse(raw).message.content
}

export async function getOllamaStatus(
  config: OllamaConfig,
  vectorIndex: OllamaVectorIndexStatus | null = null
): Promise<OllamaStatus> {
  const baseUrl = normalizeBaseUrl(config.baseUrl)
  if (!config.enabled) {
    return {
      enabled: false,
      reachable: false,
      baseUrl,
      models: [],
      embeddingModel: config.embeddingModel,
      llmModel: config.llmModel,
      embeddingModelAvailable: false,
      llmModelAvailable: false,
      vectorIndex,
      error: null
    }
  }

  try {
    const models = await listOllamaModels({ ...config, baseUrl })
    const names = new Set(models.map((model) => model.name))
    return {
      enabled: true,
      reachable: true,
      baseUrl,
      models,
      embeddingModel: config.embeddingModel,
      llmModel: config.llmModel,
      embeddingModelAvailable: names.has(config.embeddingModel),
      llmModelAvailable: names.has(config.llmModel),
      vectorIndex,
      error: null
    }
  } catch (err) {
    return {
      enabled: true,
      reachable: false,
      baseUrl,
      models: [],
      embeddingModel: config.embeddingModel,
      llmModel: config.llmModel,
      embeddingModelAvailable: false,
      llmModelAvailable: false,
      vectorIndex,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
