import type { AppConfig } from '@shared/types/config'
import { embedWithOllama } from '../ollama/client'
import { contentHash as hashContent } from '../source/util'
import type { Chunk } from './chunker'
import {
  VECTOR_TABLE,
  assertVectorDimension,
  closeVectorDb,
  deleteVectorRows,
  getVectorCounts,
  getVectorDb,
  insertIndexedVectorChunks,
  loadExistingVectorChunks,
  markPendingVectorChunks,
  prepareVectorTable,
  readActiveVectorDimension,
  readActiveVectorModel,
  readVectorMeta,
  serializeVector,
  setVectorMeta,
  vectorTableExists,
  type ExistingVectorChunk
} from './vector-store'

const MAX_SEARCH_LIMIT = 200

export interface VectorIndexResult {
  status: 'disabled' | 'indexed' | 'pending' | 'cancelled'
  indexed: number
  pending: number
  error?: string
}

export interface VectorIndexOptions {
  shouldContinue?: () => boolean
}

export interface VectorSearchResult {
  sourceId: string
  docPath: string
  title: string
  snippet: string
  distance: number
  score: number
}

export interface VectorIndexState {
  available: boolean
  model: string | null
  dimension: number | null
  indexedCount: number
  pendingCount: number
  reindexRequired: boolean
  error: string | null
}

function makeSnippet(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > 240 ? `${compact.slice(0, 240)}…` : compact
}

function clampLimit(limit: number): number {
  return Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.floor(limit)))
}

function rowsForDocument(
  existing: ExistingVectorChunk[],
  chunks: Chunk[]
): { staleRows: ExistingVectorChunk[]; changedChunks: Chunk[] } {
  const existingByChunk = new Map(existing.map((row) => [row.chunkId, row]))
  const currentChunkIds = new Set(chunks.map((chunk) => chunk.chunkId))
  const staleRows = existing.filter((row) => !currentChunkIds.has(row.chunkId))
  const changedChunks = chunks.filter((chunk) => {
    const row = existingByChunk.get(chunk.chunkId)
    return !row || row.chunkHash !== hashContent(chunk.content) || row.status !== 'indexed'
  })

  return { staleRows, changedChunks }
}

function rowsToDelete(
  existing: ExistingVectorChunk[],
  staleRows: ExistingVectorChunk[],
  changedChunks: Chunk[]
): ExistingVectorChunk[] {
  const staleIds = new Set(staleRows.map((row) => row.id))
  const changedIds = new Set(changedChunks.map((chunk) => chunk.chunkId))
  return existing.filter((row) => staleIds.has(row.id) || changedIds.has(row.chunkId))
}

export async function indexDocumentVectors(
  sourceId: string,
  docPath: string,
  title: string,
  documentHash: string,
  chunks: Chunk[],
  config: AppConfig,
  options: VectorIndexOptions = {}
): Promise<VectorIndexResult> {
  const model = config.ollama.embeddingModel.trim()
  if (!config.ollama.enabled || !model || chunks.length === 0) {
    return { status: 'disabled', indexed: 0, pending: 0 }
  }

  let changedChunks: Chunk[] = []
  let database: ReturnType<typeof getVectorDb> | null = null

  try {
    database = getVectorDb(config)
    const existing = loadExistingVectorChunks(database, sourceId, docPath, model)
    const rowPlan = rowsForDocument(existing, chunks)
    changedChunks = rowPlan.changedChunks
    deleteVectorRows(database, rowsToDelete(existing, rowPlan.staleRows, changedChunks))

    if (changedChunks.length === 0) {
      return { status: 'indexed', indexed: 0, pending: 0 }
    }
    if (options.shouldContinue && !options.shouldContinue()) {
      return { status: 'cancelled', indexed: 0, pending: 0 }
    }

    const embeddings = await embedWithOllama(
      config.ollama,
      changedChunks.map((chunk) => chunk.content)
    )
    if (embeddings.length !== changedChunks.length) {
      throw new Error('Ollama embed 返回数量与 chunk 数量不一致')
    }
    if (options.shouldContinue && !options.shouldContinue()) {
      return { status: 'cancelled', indexed: 0, pending: 0 }
    }

    const dimension = assertVectorDimension(embeddings[0] ?? [])
    prepareVectorTable(database, model, dimension)
    const indexed = insertIndexedVectorChunks(
      database,
      sourceId,
      docPath,
      title,
      documentHash,
      model,
      dimension,
      changedChunks,
      embeddings
    )
    return { status: 'indexed', indexed, pending: 0 }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    if (
      database &&
      changedChunks.length > 0 &&
      (!options.shouldContinue || options.shouldContinue())
    ) {
      markPendingVectorChunks(
        database,
        sourceId,
        docPath,
        title,
        documentHash,
        model,
        changedChunks,
        error
      )
    }
    return { status: 'pending', indexed: 0, pending: changedChunks.length, error }
  }
}

export function removeDocumentVectors(sourceId: string, docPath: string, config: AppConfig): void {
  const database = getVectorDb(config)
  const rows = database
    .prepare(
      `SELECT id, vector_rowid AS vectorRowid, chunk_id AS chunkId, chunk_hash AS chunkHash, status
       FROM vector_chunks
       WHERE source_id = ? AND doc_path = ?`
    )
    .all(sourceId, docPath) as ExistingVectorChunk[]
  deleteVectorRows(database, rows)
}

export function removeSourceVectors(sourceId: string, config: AppConfig): void {
  const database = getVectorDb(config)
  const rows = database
    .prepare(
      `SELECT id, vector_rowid AS vectorRowid, chunk_id AS chunkId, chunk_hash AS chunkHash, status
       FROM vector_chunks
       WHERE source_id = ?`
    )
    .all(sourceId) as ExistingVectorChunk[]
  deleteVectorRows(database, rows)
}

export function getVectorIndexState(config: AppConfig): VectorIndexState {
  try {
    const database = getVectorDb(config)
    const counts = getVectorCounts(database)
    const model = readActiveVectorModel(database)
    const reindexFlag = readVectorMeta(database, 'reindex_required') === 'true'
    return {
      available: vectorTableExists(database) && counts.indexed > 0,
      model,
      dimension: readActiveVectorDimension(database),
      indexedCount: counts.indexed,
      pendingCount: counts.pending,
      reindexRequired:
        reindexFlag || (model !== null && model !== config.ollama.embeddingModel.trim()),
      error: null
    }
  } catch (err) {
    return {
      available: false,
      model: null,
      dimension: null,
      indexedCount: 0,
      pendingCount: 0,
      reindexRequired: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

export async function searchSemantic(
  query: string,
  sourceId: string | null,
  config: AppConfig,
  limit = 20
): Promise<VectorSearchResult[]> {
  if (!config.ollama.enabled) {
    throw new Error('OLLAMA_DISABLED: Ollama 未启用')
  }

  const embeddings = await embedWithOllama(config.ollama, query)
  const queryEmbedding = embeddings[0]
  if (!queryEmbedding) {
    throw new Error('VECTOR_QUERY_EMBED_FAILED: 查询向量为空')
  }

  const dimension = assertVectorDimension(queryEmbedding)
  const database = getVectorDb(config)
  if (
    !vectorTableExists(database) ||
    readActiveVectorModel(database) !== config.ollama.embeddingModel ||
    readActiveVectorDimension(database) !== dimension
  ) {
    setVectorMeta(database, 'reindex_required', 'true')
    throw new Error('VECTOR_INDEX_NOT_AVAILABLE: 当前模型或维度缺少可用向量索引')
  }

  const max = clampLimit(limit)
  const k = clampLimit(max * 5)
  const stmt = database.prepare(
    sourceId
      ? `WITH matches AS (
           SELECT rowid, distance
           FROM ${VECTOR_TABLE}
           WHERE embedding MATCH ? AND k = ? AND source_id = ?
         )
         SELECT c.source_id, c.doc_path, c.title, c.content, matches.distance
         FROM matches
         JOIN vector_chunks c ON c.vector_rowid = matches.rowid
         WHERE c.status = 'indexed'
         ORDER BY matches.distance
         LIMIT ?`
      : `WITH matches AS (
           SELECT rowid, distance
           FROM ${VECTOR_TABLE}
           WHERE embedding MATCH ? AND k = ?
         )
         SELECT c.source_id, c.doc_path, c.title, c.content, matches.distance
         FROM matches
         JOIN vector_chunks c ON c.vector_rowid = matches.rowid
         WHERE c.status = 'indexed'
         ORDER BY matches.distance
         LIMIT ?`
  )
  const rows = sourceId
    ? (stmt.all(serializeVector(queryEmbedding), k, sourceId, max) as Array<
        Record<string, unknown>
      >)
    : (stmt.all(serializeVector(queryEmbedding), k, max) as Array<Record<string, unknown>>)

  const results: VectorSearchResult[] = []
  const seenDocs = new Set<string>()
  for (const row of rows) {
    const source = String(row.source_id)
    const docPath = String(row.doc_path)
    const key = `${source}::${docPath}`
    if (seenDocs.has(key)) continue
    seenDocs.add(key)
    const distance = Number(row.distance)
    results.push({
      sourceId: source,
      docPath,
      title: String(row.title),
      snippet: makeSnippet(String(row.content)),
      distance,
      score: 1 / (1 + Math.max(0, distance))
    })
    if (results.length >= max) break
  }
  return results
}

export function closeVectorIndex(): void {
  closeVectorDb()
}
