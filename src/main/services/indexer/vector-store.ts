import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { load as loadSqliteVec } from 'sqlite-vec'
import type { AppConfig } from '@shared/types/config'
import { getFtsPath } from '../../config/paths'
import { contentHash as hashContent } from '../source/util'
import type { Chunk } from './chunker'

export const VECTOR_TABLE = 'document_vectors'

let db: Database.Database | null = null

const BASE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS vector_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vector_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vector_rowid INTEGER UNIQUE,
    source_id TEXT NOT NULL,
    doc_path TEXT NOT NULL,
    chunk_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    chunk_hash TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    dimension INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(source_id, doc_path, chunk_id, embedding_model)
  );
  CREATE INDEX IF NOT EXISTS idx_vector_chunks_source ON vector_chunks(source_id);
  CREATE INDEX IF NOT EXISTS idx_vector_chunks_doc ON vector_chunks(source_id, doc_path);
  CREATE INDEX IF NOT EXISTS idx_vector_chunks_status ON vector_chunks(status);
`

export interface ExistingVectorChunk {
  id: number
  vectorRowid: number | null
  chunkId: number
  chunkHash: string
  status: string
}

export interface VectorCounts {
  indexed: number
  pending: number
}

export function getVectorDb(config: AppConfig): Database.Database {
  const path = getFtsPath(config)
  if (db && db.name === path) return db

  if (db) {
    try {
      db.close()
    } catch {
      // ignore close errors
    }
    db = null
  }

  if (!existsSync(dirname(path))) {
    mkdirSync(dirname(path), { recursive: true })
  }

  const newDb = new Database(path)
  loadSqliteVec(newDb)
  newDb.exec(BASE_SCHEMA_SQL)
  db = newDb
  return db
}

export function vectorTableExists(database: Database.Database): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(VECTOR_TABLE) as { name?: string } | undefined
  return row?.name === VECTOR_TABLE
}

export function readVectorMeta(database: Database.Database, key: string): string | null {
  const row = database.prepare('SELECT value FROM vector_meta WHERE key = ?').get(key) as
    | { value?: string }
    | undefined
  return row?.value ?? null
}

export function setVectorMeta(database: Database.Database, key: string, value: string): void {
  database
    .prepare(
      `INSERT INTO vector_meta(key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value)
}

export function readActiveVectorModel(database: Database.Database): string | null {
  return readVectorMeta(database, 'embedding_model')
}

export function readActiveVectorDimension(database: Database.Database): number | null {
  const raw = readVectorMeta(database, 'embedding_dimension')
  if (!raw) return null
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

export function serializeVector(values: number[]): Buffer {
  return Buffer.from(new Float32Array(values).buffer)
}

export function assertVectorDimension(values: number[]): number {
  const dimension = values.length
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new Error('Ollama embed 返回了空向量')
  }
  return dimension
}

export function prepareVectorTable(
  database: Database.Database,
  model: string,
  dimension: number
): void {
  const currentModel = readActiveVectorModel(database)
  const currentDimension = readActiveVectorDimension(database)
  const tableReady = vectorTableExists(database)

  if (tableReady && currentModel === model && currentDimension === dimension) return

  database.exec(`DROP TABLE IF EXISTS ${VECTOR_TABLE}; DELETE FROM vector_chunks;`)
  database.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${VECTOR_TABLE} USING vec0(
      embedding float[${dimension}] distance_metric=cosine,
      source_id text
    );`
  )
  setVectorMeta(database, 'embedding_model', model)
  setVectorMeta(database, 'embedding_dimension', String(dimension))
  setVectorMeta(database, 'reindex_required', 'false')
}

export function loadExistingVectorChunks(
  database: Database.Database,
  sourceId: string,
  docPath: string,
  model: string
): ExistingVectorChunk[] {
  return database
    .prepare(
      `SELECT
        id,
        vector_rowid AS vectorRowid,
        chunk_id AS chunkId,
        chunk_hash AS chunkHash,
        status
       FROM vector_chunks
       WHERE source_id = ? AND doc_path = ? AND embedding_model = ?`
    )
    .all(sourceId, docPath, model) as ExistingVectorChunk[]
}

export function deleteVectorRows(database: Database.Database, rows: ExistingVectorChunk[]): void {
  if (rows.length === 0) return

  const hasVectorTable = vectorTableExists(database)
  const deleteVector = database.prepare(`DELETE FROM ${VECTOR_TABLE} WHERE rowid = ?`)
  const deleteChunk = database.prepare('DELETE FROM vector_chunks WHERE id = ?')

  const tx = database.transaction(() => {
    for (const row of rows) {
      if (hasVectorTable && row.vectorRowid !== null) {
        deleteVector.run(row.vectorRowid)
      }
      deleteChunk.run(row.id)
    }
  })
  tx()
}

export function markPendingVectorChunks(
  database: Database.Database,
  sourceId: string,
  docPath: string,
  title: string,
  documentHash: string,
  model: string,
  chunks: Chunk[],
  error: string
): void {
  const insert = database.prepare(
    `INSERT INTO vector_chunks (
      vector_rowid,
      source_id,
      doc_path,
      chunk_id,
      title,
      content,
      content_hash,
      chunk_hash,
      embedding_model,
      dimension,
      status,
      error,
      updated_at
    ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'index_pending', ?, ?)
    ON CONFLICT(source_id, doc_path, chunk_id, embedding_model) DO UPDATE SET
      vector_rowid = NULL,
      title = excluded.title,
      content = excluded.content,
      content_hash = excluded.content_hash,
      chunk_hash = excluded.chunk_hash,
      dimension = 0,
      status = 'index_pending',
      error = excluded.error,
      updated_at = excluded.updated_at`
  )
  const ts = new Date().toISOString()
  const tx = database.transaction(() => {
    for (const chunk of chunks) {
      insert.run(
        sourceId,
        docPath,
        chunk.chunkId,
        title,
        chunk.content,
        documentHash,
        hashContent(chunk.content),
        model,
        error,
        ts
      )
    }
  })
  tx()
}

export function insertIndexedVectorChunks(
  database: Database.Database,
  sourceId: string,
  docPath: string,
  title: string,
  documentHash: string,
  model: string,
  dimension: number,
  chunks: Chunk[],
  embeddings: number[][]
): number {
  const insertVector = database.prepare(
    `INSERT INTO ${VECTOR_TABLE}(embedding, source_id) VALUES (?, ?)`
  )
  const insertChunk = database.prepare(
    `INSERT INTO vector_chunks (
      vector_rowid,
      source_id,
      doc_path,
      chunk_id,
      title,
      content,
      content_hash,
      chunk_hash,
      embedding_model,
      dimension,
      status,
      error,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'indexed', NULL, ?)`
  )
  const ts = new Date().toISOString()
  let indexed = 0

  const tx = database.transaction(() => {
    chunks.forEach((chunk, index) => {
      const embedding = embeddings[index]
      if (!embedding || embedding.length !== dimension) {
        throw new Error('Ollama embed 返回的向量维度不一致')
      }
      const result = insertVector.run(serializeVector(embedding), sourceId)
      insertChunk.run(
        Number(result.lastInsertRowid),
        sourceId,
        docPath,
        chunk.chunkId,
        title,
        chunk.content,
        documentHash,
        hashContent(chunk.content),
        model,
        dimension,
        ts
      )
      indexed += 1
    })
  })
  tx()
  return indexed
}

export function getVectorCounts(database: Database.Database): VectorCounts {
  const indexed = database
    .prepare("SELECT COUNT(*) AS count FROM vector_chunks WHERE status = 'indexed'")
    .get() as { count: number }
  const pending = database
    .prepare("SELECT COUNT(*) AS count FROM vector_chunks WHERE status = 'index_pending'")
    .get() as { count: number }

  return { indexed: indexed.count, pending: pending.count }
}

export function closeVectorDb(): void {
  if (db) {
    try {
      db.close()
    } catch {
      // ignore
    }
    db = null
  }
}
