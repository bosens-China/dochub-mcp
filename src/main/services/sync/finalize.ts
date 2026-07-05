import { writeFile } from 'fs/promises'
import type { AppConfig } from '@shared/types/config'
import type { SourceRecord } from '@shared/types'
import type { Checkpoint } from '@shared/types/checkpoint'
import {
  SourceMetaSchema,
  type SourceMeta,
  type SourceMetaNavigationItem
} from '@shared/types/source-meta'
import { contentHash } from '../source/util'
import { sourceDocsDir, sourceMetaPath } from '../source/store'
import { parseDocFile, serializeDocFile } from '../converter/doc-frontmatter'
import {
  buildUrlToPathIndex,
  canonicalPageUrl,
  localizeMarkdownLinks
} from '../converter/link-localizer'
import { splitIntoChunks, chunkMaxChars } from '../indexer/chunker'
import { indexDocument } from '../indexer/fts'
import { readFile } from 'fs/promises'
import { join } from 'path'

function buildSourceMeta(
  record: SourceRecord,
  urlIndex: Map<string, string>,
  documents: SourceMeta['documents'],
  navigation: SourceMetaNavigationItem[]
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
    documents,
    navigation
  })
}

function lookupDocPath(url: string, urlToPath: ReadonlyMap<string, string>): string | null {
  const canonical = canonicalPageUrl(url)
  if (!canonical) return null

  const direct = urlToPath.get(canonical)
  if (direct) return direct

  const parsed = new URL(canonical)
  if (!parsed.pathname.endsWith('/')) {
    return urlToPath.get(new URL(`${parsed.pathname}/`, parsed.origin).href) ?? null
  }

  if (parsed.pathname.length > 1) {
    const trimmed = parsed.pathname.replace(/\/$/, '')
    return urlToPath.get(new URL(trimmed, parsed.origin).href) ?? null
  }

  return null
}

function buildNavigationMeta(
  navigation: Checkpoint['navigation'],
  urlToPath: ReadonlyMap<string, string>
): SourceMetaNavigationItem[] {
  const seen = new Set<string>()
  const items: SourceMetaNavigationItem[] = []

  for (const item of [...navigation].sort((a, b) => a.order - b.order)) {
    const path = lookupDocPath(item.url, urlToPath)
    if (!path || seen.has(path)) continue

    seen.add(path)
    items.push({
      path,
      title: item.title,
      groups: item.groups,
      order: items.length
    })
  }

  return items
}

export async function finalizeSourceDocuments(
  sourceId: string,
  config: AppConfig,
  record: SourceRecord,
  completed: Checkpoint['completed'],
  navigation: Checkpoint['navigation'] = []
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
  const navigationMeta = buildNavigationMeta(navigation, urlToPath)
  const meta = buildSourceMeta(record, urlToPath, documents, navigationMeta)
  await writeFile(sourceMetaPath(sourceId, config), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
  return meta
}
