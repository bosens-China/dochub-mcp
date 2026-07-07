import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { existsSync } from 'fs'
import type { AppConfig } from '@shared/types/config'
import { getFtsPath } from '../../config/paths'
import type { Chunk } from './chunker'

let db: Database.Database | null = null

const SCHEMA_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    source_id,
    doc_path,
    chunk_id,
    title,
    content,
    tokenize = 'unicode61'
  );
  CREATE TABLE IF NOT EXISTS documents_meta (
    source_id TEXT NOT NULL,
    doc_path TEXT NOT NULL,
    chunk_id INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    char_start INTEGER,
    char_end INTEGER,
    PRIMARY KEY (source_id, doc_path, chunk_id)
  );
`

function getDb(config: AppConfig): Database.Database {
  const path = getFtsPath(config)
  if (db && db.name === path) return db

  // 关闭旧连接，容错处理避免 db 置 null 后崩溃
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
  newDb.exec(SCHEMA_SQL)
  db = newDb
  return db
}

export function indexDocument(
  sourceId: string,
  docPath: string,
  title: string,
  contentHash: string,
  chunks: Chunk[],
  config: AppConfig
): void {
  const database = getDb(config)
  const deleteFts = database.prepare(
    'DELETE FROM documents_fts WHERE source_id = ? AND doc_path = ?'
  )
  const deleteMeta = database.prepare(
    'DELETE FROM documents_meta WHERE source_id = ? AND doc_path = ?'
  )
  const insertFts = database.prepare(
    'INSERT INTO documents_fts (source_id, doc_path, chunk_id, title, content) VALUES (?, ?, ?, ?, ?)'
  )
  const insertMeta = database.prepare(
    'INSERT INTO documents_meta (source_id, doc_path, chunk_id, content_hash, char_start, char_end) VALUES (?, ?, ?, ?, ?, ?)'
  )

  const tx = database.transaction(() => {
    deleteFts.run(sourceId, docPath)
    deleteMeta.run(sourceId, docPath)
    for (const chunk of chunks) {
      insertFts.run(sourceId, docPath, chunk.chunkId, title, chunk.content)
      insertMeta.run(sourceId, docPath, chunk.chunkId, contentHash, chunk.charStart, chunk.charEnd)
    }
  })
  tx()
}

export function removeDocumentIndex(sourceId: string, docPath: string, config: AppConfig): void {
  const database = getDb(config)
  database
    .prepare('DELETE FROM documents_fts WHERE source_id = ? AND doc_path = ?')
    .run(sourceId, docPath)
  database
    .prepare('DELETE FROM documents_meta WHERE source_id = ? AND doc_path = ?')
    .run(sourceId, docPath)
}

export function searchKeyword(
  query: string,
  sourceId: string | null,
  config: AppConfig,
  limit = 20
): Array<{ sourceId: string; docPath: string; title: string; snippet: string; rank: number }> {
  const database = getDb(config)
  const sql = sourceId
    ? `SELECT
         source_id,
         doc_path,
         title,
         snippet(documents_fts, 4, '<b>', '</b>', '…', 32) AS snippet,
         bm25(documents_fts) AS score
       FROM documents_fts
       WHERE documents_fts MATCH ? AND source_id = ?
       ORDER BY score
       LIMIT ?`
    : `SELECT
         source_id,
         doc_path,
         title,
         snippet(documents_fts, 4, '<b>', '</b>', '…', 32) AS snippet,
         bm25(documents_fts) AS score
       FROM documents_fts
       WHERE documents_fts MATCH ?
       ORDER BY score
       LIMIT ?`
  const stmt = database.prepare(sql)
  const rows = sourceId
    ? (stmt.all(query, sourceId, limit) as Array<Record<string, string>>)
    : (stmt.all(query, limit) as Array<Record<string, string>>)
  return rows.map((r, index) => ({
    sourceId: r.source_id,
    docPath: r.doc_path,
    title: r.title,
    snippet: r.snippet,
    rank: index + 1
  }))
}

export function closeFts(): void {
  if (db) {
    try {
      db.close()
    } catch {
      // ignore
    }
    db = null
  }
}

/** 删除某个源的全部 FTS 索引记录（删源时调用） */
export function removeSourceIndex(sourceId: string, config: AppConfig): void {
  const database = getDb(config)
  const tx = database.transaction(() => {
    database.prepare('DELETE FROM documents_fts WHERE source_id = ?').run(sourceId)
    database.prepare('DELETE FROM documents_meta WHERE source_id = ?').run(sourceId)
  })
  tx()
}
