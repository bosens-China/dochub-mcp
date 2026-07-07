import { existsSync } from 'fs'
import { readFile, readdir, rm, writeFile } from 'fs/promises'
import { isAbsolute, join, relative, resolve } from 'path'
import type { DocTreeNode } from '@shared/types'
import type { AppConfig } from '@shared/types/config'
import {
  SourceMetaSchema,
  type SourceMeta,
  type SourceMetaNavigationItem
} from '@shared/types/source-meta'
import { extractDocBody, extractDocTitle } from '../converter/doc-frontmatter'
import { removeDocumentIndex } from '../indexer/fts'
import { removeDocumentVectors } from '../indexer/vector'
import { cancelDocumentVectorIndex } from '../indexer/vector-queue'
import { readSourceRecord, sourceDocsDir, sourceMetaPath, sourceTreePath } from '../source/store'
import { appendSyncLog } from './persistence'

export interface FlatDocTreeNode {
  key: string
  title: string
  isLeaf?: boolean
}

export async function buildTreeTxt(sourceId: string, config: AppConfig): Promise<void> {
  const docsRoot = sourceDocsDir(sourceId, config)
  if (!existsSync(docsRoot)) return

  const lines: string[] = []
  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        lines.push(`${rel}/`)
        await walk(join(dir, entry.name), rel)
      } else if (entry.name.endsWith('.md')) {
        lines.push(rel)
      }
    }
  }
  await walk(docsRoot, '')
  const record = await readSourceRecord(sourceId, config)
  const header = record ? `${record.name} (${lines.length} files)` : sourceId
  await writeFile(sourceTreePath(sourceId, config), `${header}\n${lines.join('\n')}\n`, 'utf8')
}

async function readSourceMeta(sourceId: string, config: AppConfig): Promise<SourceMeta | null> {
  const metaPath = sourceMetaPath(sourceId, config)
  if (!existsSync(metaPath)) return null

  try {
    const raw = JSON.parse(await readFile(metaPath, 'utf8')) as unknown
    return SourceMetaSchema.parse(raw)
  } catch {
    return null
  }
}

function navGroupKey(groups: string[]): string {
  return `nav:${groups.map((group) => encodeURIComponent(group)).join('/')}`
}

function ensureGroup(
  root: DocTreeNode[],
  groups: string[],
  groupMap: Map<string, DocTreeNode>
): DocTreeNode[] {
  if (groups.length === 0) return root

  let current = root
  for (let i = 0; i < groups.length; i++) {
    const groupPath = groups.slice(0, i + 1)
    const key = navGroupKey(groupPath)
    let group = groupMap.get(key)
    if (!group) {
      group = {
        key,
        title: groups[i]!,
        isLeaf: false,
        children: []
      }
      groupMap.set(key, group)
      current.push(group)
    }
    current = group.children ?? []
  }

  return current
}

function isReadableNavItem(item: SourceMetaNavigationItem, docsRoot: string): boolean {
  if (!item.path.startsWith('docs/') || !item.path.endsWith('.md')) return false
  const fullPath = join(docsRoot, item.path.replace(/^docs\//, ''))
  return existsSync(fullPath)
}

function resolveDocFilePath(
  docsRoot: string,
  docPath: string
): { fullPath: string; docKey: string } {
  if (docPath.includes('\0') || docPath.includes('\\')) {
    throw new Error('无效的文件路径')
  }

  const docKey = docPath.startsWith('docs/') ? docPath : `docs/${docPath}`
  if (!docKey.endsWith('.md')) {
    throw new Error('无效的文件路径')
  }

  const relativePath = docKey.replace(/^docs\//, '')
  const root = resolve(docsRoot)
  const fullPath = resolve(root, relativePath)
  const relToRoot = relative(root, fullPath)
  if (relToRoot.startsWith('..') || isAbsolute(relToRoot)) {
    throw new Error('无效的文件路径')
  }

  return { fullPath, docKey }
}

export async function listNavigationDocTree(
  sourceId: string,
  config: AppConfig
): Promise<DocTreeNode[] | null> {
  const docsRoot = sourceDocsDir(sourceId, config)
  const meta = await readSourceMeta(sourceId, config)
  if (!meta || meta.navigation.length === 0 || !existsSync(docsRoot)) return null

  const root: DocTreeNode[] = []
  const groupMap = new Map<string, DocTreeNode>()
  const seenPaths = new Set<string>()

  const items = meta.navigation
    .filter((item) => isReadableNavItem(item, docsRoot))
    .sort((a, b) => a.order - b.order)

  for (const item of items) {
    if (seenPaths.has(item.path)) continue
    const children = ensureGroup(root, item.groups, groupMap)
    children.push({
      key: item.path,
      title: item.title,
      isLeaf: true
    })
    seenPaths.add(item.path)
  }

  return root.length > 0 ? root : null
}

export async function listDocTree(sourceId: string, config: AppConfig): Promise<FlatDocTreeNode[]> {
  const docsRoot = sourceDocsDir(sourceId, config)
  if (!existsSync(docsRoot)) return []

  const nodes: FlatDocTreeNode[] = []

  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        nodes.push({ key: rel, title: entry.name })
        await walk(join(dir, entry.name), rel)
      } else if (entry.name.endsWith('.md')) {
        const fullPath = join(dir, entry.name)
        const raw = await readFile(fullPath, 'utf8')
        const fallback = entry.name.replace(/\.md$/, '')
        const title = extractDocTitle(raw, fallback)
        nodes.push({ key: `docs/${rel}`, title, isLeaf: true })
      }
    }
  }
  await walk(docsRoot, '')
  return nodes
}

export async function readDocContent(
  sourceId: string,
  docPath: string,
  config: AppConfig
): Promise<{ path: string; title: string; body: string }> {
  const { fullPath, docKey } = resolveDocFilePath(sourceDocsDir(sourceId, config), docPath)
  if (!existsSync(fullPath)) {
    throw new Error('文档不存在')
  }
  const raw = await readFile(fullPath, 'utf8')
  const relativePath = docKey.replace(/^docs\//, '')
  const fallback = relativePath.split('/').pop()?.replace(/\.md$/, '') ?? docPath
  const title = extractDocTitle(raw, fallback)
  const body = extractDocBody(raw)
  return { path: docKey, title, body }
}

/** 返回文档正文 */
export async function readDocFile(
  sourceId: string,
  docPath: string,
  config: AppConfig
): Promise<string> {
  const doc = await readDocContent(sourceId, docPath, config)
  return doc.body
}

export async function deleteRemovedDocs(
  sourceId: string,
  currentPaths: Set<string>,
  config: AppConfig
): Promise<void> {
  const docsRoot = sourceDocsDir(sourceId, config)
  if (!existsSync(docsRoot)) return

  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const docKey = `docs/${rel}`
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), rel)
      } else if (entry.name.endsWith('.md') && !currentPaths.has(docKey)) {
        await rm(join(dir, entry.name))
        removeDocumentIndex(sourceId, docKey, config)
        try {
          cancelDocumentVectorIndex(sourceId, docKey)
          removeDocumentVectors(sourceId, docKey, config)
        } catch {
          // Vector index cleanup is best-effort; FTS and files remain canonical.
        }
        await appendSyncLog(
          {
            ts: new Date().toISOString(),
            sourceId,
            action: 'delete',
            path: docKey,
            reason: 'removed_from_site'
          },
          config
        )
      }
    }
  }
  await walk(docsRoot, '')
}
