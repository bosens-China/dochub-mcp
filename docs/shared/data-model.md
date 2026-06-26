# DocHub 数据模型

## 1. 目录结构

```
~/dochub/
├── config.json                 # 全局配置
├── sync.log.jsonl              # 同步日志（append-only）
├── sources/
│   └── {sourceId}/
│       ├── _source.json        # 源定义与同步状态
│       ├── _meta.json          # URL ↔ 路径索引（同步后更新）
│       ├── _tree.txt           # 文档树文字（MCP 快速返回）
│       ├── _discovery.json     # 域名级 discovery 缓存
│       └── docs/               # 镜像文档（URL path → 文件 path）
│           └── guide/
│               └── index.md
└── .index/
    ├── fts.db                  # SQLite FTS5
    └── checkpoints/
        └── {sourceId}.json     # 爬取断点
```

## 2. 全局配置 `config.json`

见 [config.md](./config.md)。

## 3. 源定义 `_source.json`

```typescript
interface SpaDetectionSnapshot {
  detectedAt: string
  seedUrl: string
  confidence: 'likely_ssr' | 'uncertain' | 'likely_spa'
  score: number                // 0–100
  recommendedMode: 'ssr' | 'spa' | 'auto'
  userConfirmedMode?: 'ssr' | 'spa' | 'auto'
  signals: { id: string; hit: boolean; label: string }[]
  previewCharCount: number
}

interface Source {
  id: string
  name: string
  seedUrl: string
  scope: {
    type: 'path_prefix'
    prefix: string
  }
  discovery: {
    domain: string
    llmsFullUrl?: string
    llmsUrl?: string
    sitemapUrl?: string
  }
  crawl: {
    mode: 'auto' | 'ssr' | 'spa'
    spaDetection?: SpaDetectionSnapshot
    concurrency?: number
    rateLimit?: RateLimitConfig
    customHeaders: Record<string, string>
    excludePatterns?: string[]
    respectRobots: boolean
    maxRetriesPerUrl: number
    domainFailureThreshold: number
    maxDepth?: number | null
    maxPages?: number | null
  }
  sync: {
    status: 'idle' | 'syncing' | 'paused' | 'completed' | 'failed' | 'domain_halted'
    lastSyncAt: string | null
    lastSyncDurationMs: number | null
    pageCount: number
    failedUrlCount: number
  }
  createdAt: string
  updatedAt: string
}
```

### `SpaDetectionSnapshot`

首屏 SSR 抓取后的侦测快照，详见 [spa-detection.md](./spa-detection.md)。

## 4. Discovery 缓存 `_discovery.json`

同域名多源共享（按 domain 键存储，或在源内缓存）：

```typescript
interface DiscoveryCache {
  domain: string
  fetchedAt: string
  siteMeta: {
    title?: string
    charset?: string
    language?: string
  }
  llmsFull?: {
    url: string
    raw: string
    parsedUrls: string[]        // 解析成功的 URL
    parseOk: boolean
  }
  llms?: {
    url: string
    raw: string
    parsedUrls: string[]
    parseOk: boolean
  }
  sitemap?: {
    url: string
    urls: string[]
  }
}
```

## 5. 文档文件 `docs/**/*.md`

每篇文档带 YAML frontmatter：

```markdown
---
sourceUrl: https://electron-vite.org/guide/
originalUrl: https://electron-vite.org/guide/introduction
title: Introduction
contentHash: sha256:abc123...
syncedAt: 2026-06-26T10:00:00Z
language: en
needsSpa: false
---

# Introduction

正文内容（同步结束后会将 scope 内链接改写为本地相对路径；站外链接保留原 URL）。
```

## 6. 文档树 `_tree.txt`

MCP `list_source_tree` 直接返回或基于此生成：

```
electron-vite (23 pages, synced 2026-06-26)
├── guide/
│   ├── introduction.md
│   ├── installation.md
│   └── ...
└── ...
```

## 7. 源级索引 `_meta.json`

每次同步结束后生成/更新，供 MCP 与链接本地化使用：

```typescript
interface SourceMetaDocument {
  url: string                     // 原始页面 URL
  path: string                    // docs/ 下相对路径，如 docs/guide/index.md
  title: string
  contentHash: string             // sha256:...
  syncedAt: string
}

interface SourceMeta {
  sourceId: string
  name: string
  seedUrl: string
  scopePrefix: string             // path-only，如 /guide/
  origin: string                  // 如 https://electron-vite.org
  updatedAt: string
  pageCount: number
  urlIndex: Record<string, string> // url → path，快速查找
  documents: SourceMetaDocument[] // 按 path 排序
}
```

**示例片段：**

```json
{
  "sourceId": "electron-vite-org-guide",
  "name": "Electron-Vite",
  "seedUrl": "https://electron-vite.org/guide/",
  "scopePrefix": "/guide/",
  "origin": "https://electron-vite.org",
  "updatedAt": "2026-06-26T10:00:00Z",
  "pageCount": 2,
  "urlIndex": {
    "https://electron-vite.org/guide/": "docs/index.md",
    "https://electron-vite.org/guide/installation.html": "docs/installation.md"
  },
  "documents": [
    {
      "url": "https://electron-vite.org/guide/",
      "path": "docs/index.md",
      "title": "Guide",
      "contentHash": "sha256:…",
      "syncedAt": "2026-06-26T10:00:00Z"
    }
  ]
}
```

## 8. Checkpoint `checkpoints/{sourceId}.json`

```typescript
interface Checkpoint {
  sourceId: string
  startedAt: string
  updatedAt: string
  status: 'running' | 'paused'
  pending: string[]             // 待爬 URL
  completed: Record<string, { hash: string; path: string }>
  failed: Record<string, { attempts: number; lastError: string }>
  domainFailureCount: number    // 当前域名累计失败 URL 数
}
```

## 9. FTS 索引表结构

```sql
CREATE VIRTUAL TABLE documents_fts USING fts5(
  source_id,
  doc_path,
  chunk_id,
  title,
  content,
  tokenize = 'unicode61'
);

CREATE TABLE documents_meta (
  source_id TEXT NOT NULL,
  doc_path TEXT NOT NULL,
  chunk_id INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  char_start INTEGER,
  char_end INTEGER,
  PRIMARY KEY (source_id, doc_path, chunk_id)
);
```

## 9. Chunk 规则

```
输入：MD 文档全文
1. if len(content) <= chunk.maxChars → 1 chunk
2. else 按 ## / ### 标题分段
3. 若单段仍超 maxChars → 按空行（段落）切
4. 若单段仍超 maxChars → 按 maxChars 硬切（兜底）
5. 每 chunk 写入 FTS，chunk_id 从 0 递增
```

默认 `chunk.maxChars = 10000`，可在 `config.json` 修改。

## 10. 同步日志 `sync.log.jsonl`

每行一条 JSON：

```json
{
  "ts": "2026-06-26T10:00:00Z",
  "sourceId": "electron-vite-guide",
  "action": "delete",
  "url": "https://electron-vite.org/guide/removed-page",
  "path": "docs/guide/removed-page.md",
  "reason": "not_in_remote_tree"
}
```

`action` 枚举：`fetch` | `skip` | `update` | `delete` | `fail` | `domain_halt`

## 11. 源命名规则

- 默认名称：从 seed URL 生成，如 `electron-vite-guide`
- 用户可在 UI 修改为任意显示名（如 `langchain`）
- `id` 内部唯一，创建后不变

## 12. 相关文档

- [v1 PRD](../v1/prd.md)
- [config.md](./config.md)
- [mcp-tools.md](./mcp-tools.md)
