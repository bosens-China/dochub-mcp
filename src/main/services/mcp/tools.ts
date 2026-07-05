import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { DocSource, DocTreeNode } from '@shared/types'
import { sourceManager } from '../source/manager'

const READ_ONLY = { readOnlyHint: true, destructiveHint: false } as const

const INSTRUCTIONS = [
  'DocHub provides local mirrored documentation. Workflow:',
  '1. list_sources — see available doc sources',
  '2. list_source_tree — get the document tree for a source',
  '3. read_document — fetch full Markdown by path',
  '4. search_documents — keyword search within a source (mode=keyword only in v1)',
  '',
  'Semantic / hybrid search requires Ollama (v2).'
].join('\n')

/** Resolve a source by its id OR display name (case-insensitive). */
async function resolveSource(sourceRef: string): Promise<DocSource> {
  const sources = await sourceManager.listSources()
  const q = sourceRef.trim().toLowerCase()
  const found = sources.find((s) => s.id.toLowerCase() === q || s.name.toLowerCase() === q)
  if (!found) {
    throw new Error(`SOURCE_NOT_FOUND: 未找到文档源 "${sourceRef}"`)
  }
  return found
}

function jsonContent(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
}

/** Render DocTreeNode[] as an indented text tree. */
function renderTreeText(nodes: DocTreeNode[], prefix = ''): string {
  const lines: string[] = []
  nodes.forEach((node, i) => {
    const isLast = i === nodes.length - 1
    const branch = isLast ? '└── ' : '├── '
    const label = node.isLeaf ? node.title : `${node.title}/`
    lines.push(`${prefix}${branch}${label}`)
    if (node.children && node.children.length > 0) {
      lines.push(renderTreeText(node.children, `${prefix}${isLast ? '    ' : '│   '}`))
    }
  })
  return lines.filter(Boolean).join('\n')
}

/** Convert DocTreeNode[] to the JSON tree shape documented in mcp-tools.md. */
function toJsonTree(
  nodes: DocTreeNode[]
): Array<{ type: 'dir' | 'file'; name: string; path?: string; children?: unknown[] }> {
  return nodes.map((node) =>
    node.isLeaf
      ? { type: 'file', name: node.title, path: node.key.replace(/^docs\//, '') }
      : { type: 'dir', name: node.title, children: toJsonTree(node.children ?? []) }
  )
}

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'dochub', version: '1.0.0' }, { instructions: INSTRUCTIONS })

  server.registerTool(
    'list_sources',
    {
      description: '列出所有已同步的文档源（含页数、同步状态、最近同步时间）。',
      inputSchema: {},
      annotations: READ_ONLY
    },
    async () => {
      const sources = await sourceManager.listSources()
      return jsonContent({
        sources: sources.map((s) => ({
          id: s.id,
          name: s.name,
          seedUrl: s.seedUrl,
          pageCount: s.pageCount,
          syncStatus: s.status,
          lastSyncAt: s.lastSyncedAt
        }))
      })
    }
  )

  server.registerTool(
    'list_source_tree',
    {
      description: '返回指定源的文档树（text 或 json）。source 可传源的 name 或 id。',
      inputSchema: {
        source: z.string().describe('源的 name 或 id'),
        format: z.enum(['text', 'json']).optional().describe('默认 text')
      },
      annotations: READ_ONLY
    },
    async ({ source, format }) => {
      const src = await resolveSource(source)
      const tree = await sourceManager.getDocTree(src.id)
      if (format === 'json') {
        return jsonContent({ source: src.name, pageCount: src.pageCount, tree: toJsonTree(tree) })
      }
      const header = `${src.name} (${src.pageCount} pages${
        src.lastSyncedAt ? `, synced ${src.lastSyncedAt}` : ''
      })`
      const body = renderTreeText(tree)
      return { content: [{ type: 'text', text: body ? `${header}\n${body}` : header }] }
    }
  )

  server.registerTool(
    'read_document',
    {
      description:
        '读取指定 Markdown 文档全文。path 为相对 docs/ 的路径，如 guide/introduction.md。',
      inputSchema: {
        source: z.string().describe('源的 name 或 id'),
        path: z.string().describe('相对 docs/ 的文档路径')
      },
      annotations: READ_ONLY
    },
    async ({ source, path }) => {
      const src = await resolveSource(source)
      try {
        const doc = await sourceManager.readDocument(src.id, path)
        return jsonContent({
          source: src.name,
          path: doc.path,
          title: doc.title,
          content: doc.body
        })
      } catch {
        throw new Error(`DOCUMENT_NOT_FOUND: 文档不存在 "${path}"（源 ${src.name}）`)
      }
    }
  )

  server.registerTool(
    'search_documents',
    {
      description: '在指定源（或全部源）中按关键词搜索文档。v1 仅支持 mode=keyword。',
      inputSchema: {
        query: z.string().describe('搜索关键词'),
        source: z.string().optional().describe('限定源；省略则搜全部'),
        mode: z.enum(['keyword', 'semantic', 'hybrid']).optional().describe('v1 仅 keyword'),
        limit: z.number().int().min(1).max(50).optional().describe('默认 10，最大 50')
      },
      annotations: READ_ONLY
    },
    async ({ query, source, mode, limit }) => {
      if (mode === 'semantic' || mode === 'hybrid') {
        throw new Error(
          'SEMANTIC_NOT_AVAILABLE: Semantic search requires Ollama (v2). Use mode=keyword.'
        )
      }
      const sourceId = source ? (await resolveSource(source)).id : null
      const max = limit ?? 10
      const results = await sourceManager.searchDocuments(query, sourceId)
      return jsonContent({
        results: results.slice(0, max).map((r) => ({
          source: r.sourceName,
          path: r.docPath,
          title: r.title,
          snippet: r.snippet
        }))
      })
    }
  )

  server.registerTool(
    'get_sync_status',
    {
      description: '查询源同步状态。省略 source 则返回全部源状态。',
      inputSchema: {
        source: z.string().optional().describe('源的 name 或 id；省略返回全部')
      },
      annotations: READ_ONLY
    },
    async ({ source }) => {
      const sources = await sourceManager.listSources()
      const progressList = await sourceManager.getSyncProgress()
      const active = Array.isArray(progressList) ? progressList : progressList ? [progressList] : []
      const wanted = source ? (await resolveSource(source)).id : null

      const rows = sources
        .filter((s) => !wanted || s.id === wanted)
        .map((s) => {
          const p = active.find((a) => a.sourceId === s.id)
          return {
            id: s.id,
            name: s.name,
            status: s.status,
            lastSyncAt: s.lastSyncedAt,
            progress: p ? { total: p.total, completed: p.completed, failed: p.failed } : null
          }
        })
      return jsonContent({ sources: rows })
    }
  )

  return server
}
