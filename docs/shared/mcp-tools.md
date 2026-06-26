# DocHub MCP Tools 定义

## 1. 传输与接入

| 项 | 值 |
|----|-----|
| 协议 | MCP Streamable HTTP |
| 端点 | `http://127.0.0.1:{port}/mcp` |
| 默认端口 | `8276`（可配置） |
| 默认状态 | `enabled: true`（可在 UI 关闭） |
| 绑定 | 仅 `127.0.0.1` |

同端口 REST 见 [http-api.md](./http-api.md)（`GET /health`）。

### Cursor 配置示例

```json
{
  "mcpServers": {
    "dochub": {
      "url": "http://127.0.0.1:8276/mcp"
    }
  }
}
```

## 2. Server Instructions（建议）

```
DocHub provides local mirrored documentation. Workflow:
1. list_sources — see available doc sources
2. list_source_tree — get document tree for a source (e.g. "langchain")
3. read_document — fetch full MD by path
4. search_documents — keyword search within a source (mode=keyword only in v1)

Semantic/hybrid search requires Ollama (v2).
```

## 3. Tools

### 3.1 `list_sources`

列出所有已同步的文档源。

| 属性 | 值 |
|------|-----|
| readOnlyHint | true |
| destructiveHint | false |

**输入：** 无

**输出：**

```json
{
  "sources": [
    {
      "id": "electron-vite-guide",
      "name": "electron-vite",
      "seedUrl": "https://electron-vite.org/guide/",
      "pageCount": 23,
      "syncStatus": "completed",
      "lastSyncAt": "2026-06-26T10:00:00Z"
    }
  ]
}
```

---

### 3.2 `list_source_tree`

返回指定源的文档树（文字或 JSON）。

| 属性 | 值 |
|------|-----|
| readOnlyHint | true |
| destructiveHint | false |

**输入：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | string | 是 | 源 name 或 id |
| `format` | enum | 否 | `text`（默认）或 `json` |

**输出（format=text）：**

```
electron-vite (23 pages, synced 2026-06-26)
├── guide/
│   ├── introduction.md
│   └── installation.md
```

**输出（format=json）：**

```json
{
  "source": "electron-vite",
  "pageCount": 23,
  "tree": [
    { "type": "dir", "name": "guide", "children": [
      { "type": "file", "name": "introduction.md", "path": "guide/introduction.md" }
    ]}
  ]
}
```

---

### 3.3 `read_document`

读取指定 MD 文档全文。

| 属性 | 值 |
|------|-----|
| readOnlyHint | true |
| destructiveHint | false |

**输入：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | string | 是 | 源 name 或 id |
| `path` | string | 是 | 相对 docs/ 的路径，如 `guide/introduction.md` |

**输出：**

```json
{
  "source": "electron-vite",
  "path": "guide/introduction.md",
  "title": "Introduction",
  "originalUrl": "https://electron-vite.org/guide/introduction",
  "syncedAt": "2026-06-26T10:00:00Z",
  "content": "# Introduction\n\n..."
}
```

---

### 3.4 `search_documents`

在指定源（或全部源）中搜索文档。

| 属性 | 值 |
|------|-----|
| readOnlyHint | true |
| destructiveHint | false |

**输入：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 搜索关键词 |
| `source` | string | 否 | 限定源；省略则搜全部 |
| `mode` | enum | 否 | v1 仅 `keyword`；`semantic`/`hybrid` 返回错误 |
| `limit` | number | 否 | 默认 10，最大 50 |

**v1 行为：**

- `mode=keyword` 或未指定 → FTS 检索
- `mode=semantic` 或 `hybrid` → 返回错误：`Semantic search requires Ollama (v2). Use mode=keyword.`

**输出：**

```json
{
  "results": [
    {
      "source": "electron-vite",
      "path": "guide/build.md",
      "chunkId": 0,
      "title": "Build",
      "snippet": "...electron-vite build configuration...",
      "score": 0.82
    }
  ]
}
```

---

### 3.5 `get_sync_status`（可选）

查询源同步状态。

| 属性 | 值 |
|------|-----|
| readOnlyHint | true |
| destructiveHint | false |

**输入：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | string | 否 | 省略则返回全部源状态 |

**输出：**

```json
{
  "sources": [
    {
      "id": "electron-vite-guide",
      "name": "electron-vite",
      "status": "syncing",
      "progress": { "total": 50, "completed": 23, "failed": 1 },
      "lastSyncAt": "2026-06-26T10:00:00Z"
    }
  ]
}
```

## 4. v1 不暴露的写操作

同步触发、源增删改仅通过客户端 UI 完成，不通过 MCP 暴露（避免 AI 误操作）。

写操作工具如有需要，在 v2+ 单独设计并加 `destructiveHint: true`。

## 5. 错误码

| code | 说明 |
|------|------|
| `SOURCE_NOT_FOUND` | 源不存在 |
| `DOCUMENT_NOT_FOUND` | 文档路径不存在 |
| `SEMANTIC_NOT_AVAILABLE` | v1 不支持语义搜索 |
| `SYNC_IN_PROGRESS` | 源正在同步（read 仍可用） |

## 6. 相关文档

- [v1 PRD](../v1/prd.md)
- [config.md](./config.md)
