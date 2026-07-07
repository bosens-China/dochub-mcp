export interface OllamaModel {
  name: string
  modifiedAt?: string
  size?: number
  digest?: string
}

export interface OllamaVectorIndexStatus {
  available: boolean
  model: string | null
  dimension: number | null
  indexedCount: number
  pendingCount: number
  queuedCount: number
  activeCount: number
  reindexRequired: boolean
  error: string | null
}

export interface OllamaStatus {
  enabled: boolean
  reachable: boolean
  baseUrl: string
  models: OllamaModel[]
  embeddingModel: string
  llmModel: string
  embeddingModelAvailable: boolean
  llmModelAvailable: boolean
  vectorIndex: OllamaVectorIndexStatus | null
  error: string | null
}
