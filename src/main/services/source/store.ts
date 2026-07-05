import { mkdir, readFile, writeFile, readdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import type { AppConfig } from '@shared/types/config'
import type { AddSourceInput, SourceRecord, UpdateSourceInput } from '@shared/types'
import { SourceRecordSchema } from '@shared/types'
import { getSourceDir, getSourcesDir } from '../../config/paths'
import { pathPrefixFromSeed, slugFromUrl } from './util'
import { removeSourceIndex } from '../indexer/fts'

function sourceRecordPath(sourceId: string, config: AppConfig): string {
  return join(getSourceDir(sourceId, config), '_source.json')
}

export async function listSourceRecords(config: AppConfig): Promise<SourceRecord[]> {
  const root = getSourcesDir(config)
  if (!existsSync(root)) return []
  const entries = await readdir(root, { withFileTypes: true })
  const records: SourceRecord[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = join(root, entry.name, '_source.json')
    if (!existsSync(metaPath)) continue
    const raw = JSON.parse(await readFile(metaPath, 'utf8')) as unknown
    records.push(SourceRecordSchema.parse(raw))
  }
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function readSourceRecord(
  sourceId: string,
  config: AppConfig
): Promise<SourceRecord | null> {
  const path = sourceRecordPath(sourceId, config)
  if (!existsSync(path)) return null
  const raw = JSON.parse(await readFile(path, 'utf8')) as unknown
  return SourceRecordSchema.parse(raw)
}

export async function writeSourceRecord(record: SourceRecord, config: AppConfig): Promise<void> {
  const dir = getSourceDir(record.id, config)
  await mkdir(join(dir, 'docs'), { recursive: true })
  const path = sourceRecordPath(record.id, config)
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
}

export async function createAndWriteSourceRecord(
  input: AddSourceInput,
  config: AppConfig
): Promise<SourceRecord> {
  const seedUrl = input.seedUrl.trim()
  const now = new Date().toISOString()
  const url = new URL(seedUrl)
  const id = slugFromUrl(seedUrl)
  const prefix = input.pathPrefix || pathPrefixFromSeed(seedUrl)

  // ID 冲突检测
  const existing = await readSourceRecord(id, config)
  if (existing) {
    throw new Error(`已存在同名文档源 "${existing.name}"\uff0c请修改 URL 或先删除已有源。`)
  }

  const record = SourceRecordSchema.parse({
    id,
    name: input.name.trim(),
    seedUrl,
    scope: { type: 'path_prefix', prefix },
    discovery: { domain: url.origin },
    crawl: {
      mode: input.crawlMode,
      customHeaders: {},
      excludePatterns: [],
      maxPages: input.maxPages ?? null
    },
    sync: {
      status: 'idle',
      lastSyncAt: null,
      lastSyncDurationMs: null,
      pageCount: 0,
      failedUrlCount: 0
    },
    createdAt: now,
    updatedAt: now
  })

  await writeSourceRecord(record, config)
  return record
}

export function createSourceRecord(input: AddSourceInput): SourceRecord {
  const seedUrl = input.seedUrl.trim()
  const now = new Date().toISOString()
  const url = new URL(seedUrl)
  const id = slugFromUrl(seedUrl)
  const prefix = input.pathPrefix || pathPrefixFromSeed(seedUrl)

  return SourceRecordSchema.parse({
    id,
    name: input.name.trim(),
    seedUrl,
    scope: { type: 'path_prefix', prefix },
    discovery: { domain: url.origin },
    crawl: {
      mode: input.crawlMode,
      customHeaders: {},
      excludePatterns: [],
      maxPages: input.maxPages ?? null
    },
    sync: {
      status: 'idle',
      lastSyncAt: null,
      lastSyncDurationMs: null,
      pageCount: 0,
      failedUrlCount: 0
    },
    createdAt: now,
    updatedAt: now
  })
}

export async function updateSourceRecord(
  input: UpdateSourceInput,
  config: AppConfig
): Promise<SourceRecord> {
  const existing = await readSourceRecord(input.id, config)
  if (!existing) {
    throw new Error(`文档源不存在: ${input.id}`)
  }

  const seedUrl = input.seedUrl?.trim() ?? existing.seedUrl
  const record = SourceRecordSchema.parse({
    ...existing,
    name: input.name?.trim() ?? existing.name,
    seedUrl,
    scope: input.pathPrefix
      ? { type: 'path_prefix', prefix: input.pathPrefix }
      : input.seedUrl
        ? { type: 'path_prefix', prefix: pathPrefixFromSeed(seedUrl) }
        : existing.scope,
    discovery: input.seedUrl ? { domain: new URL(seedUrl).origin } : existing.discovery,
    crawl: {
      ...existing.crawl,
      mode: input.crawlMode ?? existing.crawl.mode,
      customHeaders: input.customHeaders ?? existing.crawl.customHeaders,
      excludePatterns: input.excludePatterns ?? existing.crawl.excludePatterns,
      respectRobots: input.respectRobots ?? existing.crawl.respectRobots,
      concurrency: input.concurrency ?? existing.crawl.concurrency,
      maxRetriesPerUrl: input.maxRetriesPerUrl ?? existing.crawl.maxRetriesPerUrl,
      maxPages: input.maxPages !== undefined ? input.maxPages : existing.crawl.maxPages
    },
    updatedAt: new Date().toISOString()
  })

  await writeSourceRecord(record, config)
  return record
}

export async function deleteSourceRecord(sourceId: string, config: AppConfig): Promise<void> {
  // 先清理 FTS 索引，再删除文件（避免 orphan 索引污染搜索结果）
  try {
    removeSourceIndex(sourceId, config)
  } catch {
    // 如果索引不存在或已损坏，不阻断删源
  }
  const dir = getSourceDir(sourceId, config)
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true })
  }
}

export function sourceDocsDir(sourceId: string, config: AppConfig): string {
  return join(getSourceDir(sourceId, config), 'docs')
}

export function sourceTreePath(sourceId: string, config: AppConfig): string {
  return join(getSourceDir(sourceId, config), '_tree.txt')
}

export function sourceMetaPath(sourceId: string, config: AppConfig): string {
  return join(getSourceDir(sourceId, config), '_meta.json')
}
