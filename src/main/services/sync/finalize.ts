import { writeFile } from 'fs/promises'
import type { AppConfig } from '@shared/types/config'
import type { SourceRecord } from '@shared/types'
import type { Checkpoint } from '@shared/types/checkpoint'
import { SourceMetaSchema, type SourceMeta } from '@shared/types/source-meta'
import { contentHash } from '../source/util'
import { sourceDocsDir, sourceMetaPath } from '../source/store'
import { parseDocFile, serializeDocFile } from '../converter/doc-frontmatter'
import { buildUrlToPathIndex, localizeMarkdownLinks } from '../converter/link-localizer'
import { splitIntoChunks, chunkMaxChars } from '../indexer/chunker'
import { indexDocument } from '../indexer/fts'
import { readFile } from 'fs/promises'
import { join } from 'path'

function buildSourceMeta(
  record: SourceRecord,
  urlIndex: Map<string, string>,
  documents: SourceMeta['documents']
): SourceMeta {
  return SourceMetaSchema.parse({
    sourceId: record.id,
    name: record.name,
    seedUrl: record.seedUrl,
    scopePrefix: record.scope.prefix,
    origin: record.discovery.domain,
    updatedAt: new Date().toISOString(),
    pageCount: documents.length,
    urlIndex: Object.fromEntries(urlIndex.entries()),
    documents
  })
}

export async function finalizeSourceDocuments(
  sourceId: string,
  config: AppConfig,
  record: SourceRecord,
  completed: Checkpoint['completed']
): Promise<SourceMeta> {
  const urlToPath = buildUrlToPathIndex(completed)
  const origin = new URL(record.seedUrl).origin
  const documents: SourceMeta['documents'] = []

  for (const [url, entry] of Object.entries(completed)) {
    const fullPath = join(sourceDocsDir(sourceId, config), entry.path.replace(/^docs\//, ''))
    const raw = await readFile(fullPath, 'utf8')
    const parsed = parseDocFile(raw)
    if (!parsed) continue

    const localizedBody = localizeMarkdownLinks(parsed.body, {
      currentDocPath: entry.path,
      scopePrefix: record.scope.prefix,
      origin,
      urlToPath
    })

    const localizedHash = contentHash(localizedBody)
    const frontmatter = {
      ...parsed.frontmatter,
      originalUrl: url,
      contentHash: `sha256:${localizedHash}`,
      syncedAt: new Date().toISOString()
    }

    await writeFile(fullPath, serializeDocFile(frontmatter, localizedBody), 'utf8')

    const chunks = splitIntoChunks(localizedBody, chunkMaxChars(config))
    indexDocument(sourceId, entry.path, frontmatter.title, localizedHash, chunks, config)

    documents.push({
      url,
      path: entry.path,
      title: frontmatter.title,
      contentHash: frontmatter.contentHash,
      syncedAt: frontmatter.syncedAt
    })
  }

  documents.sort((a, b) => a.path.localeCompare(b.path))
  const meta = buildSourceMeta(record, urlToPath, documents)
  await writeFile(sourceMetaPath(sourceId, config), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
  return meta
}
