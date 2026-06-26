# DocHub 项目目录结构

> Electron 应用：**没有独立部署的后端进程**，业务逻辑运行在 **Main Process**（Node.js）。  
> 对外暴露的 MCP HTTP 服务也跑在 Main Process 内，不是单独的后端仓库。

---

## 1. 推荐目录（v1 起）

```
DocHub-MCP/
├── docs/                          # 产品 & 技术文档
├── resources/                     # 图标等静态资源
├── src/
│   ├── main/                      # ★ 「后端」：Electron 主进程
│   │   ├── index.ts               # 应用入口：窗口、托盘、生命周期
│   │   ├── services/              # 业务服务（爬虫、索引、MCP 等）
│   │   │   ├── mcp/               # Hono app + MCP transport + lifecycle
│   │   │   │   ├── server.ts
│   │   │   │   ├── tools/
│   │   │   │   └── lifecycle.ts   # start / stop / restart
│   │   │   ├── source/            # 文档源 CRUD、同步调度
│   │   │   ├── discovery/         # URL 发现：llms / sitemap / BFS
│   │   │   ├── crawler/           # 抓取、重试、checkpoint
│   │   │   ├── converter/         # HTML → MD（mdream）
│   │   │   ├── indexer/           # FTS /（v2）向量
│   │   │   └── search/            # 检索 API（供 MCP 调用）
│   │   ├── ipc/                   # 渲染进程 ↔ 主进程 IPC 注册
│   │   │   ├── handlers/
│   │   │   └── channels.ts
│   │   ├── config/                # 读写 ~/dochub/config.json
│   │   └── tray/                  # 系统托盘
│   │
│   ├── renderer/                  # ★ 「前端」：React UI
│   │   └── src/
│   │       ├── pages/             # 源管理、设置、浏览、同步日志
│   │       ├── components/
│   │       └── App.tsx
│   │
│   ├── preload/                   # contextBridge，暴露安全 API
│   │   └── index.ts
│   │
│   └── shared/                    # 前后端共享
│       ├── types/                 # Source、Config、McpStatus 等
│       ├── constants/             # 默认端口 8276 等
│       └── ipc-channels.ts        # IPC 通道名常量
│
├── electron.vite.config.ts
├── package.json
└── tsconfig*.json
```

---

## 2. 为什么放在 `src/main/services/` 而不是根目录 `backend/`

| 方案 | 说明 |
|------|------|
| **`src/main/services/`（推荐）** | 符合 electron-vite 惯例；Main = Node 后端；打包配置简单 |
| `src/backend/` | 可行，但需额外配置 alias 与 main 的 import 路径 |
| 仓库根 `backend/` | 适合**独立 Node 服务**（如将来拆成 CLI + 桌面壳）；当前阶段过度设计 |

若将来拆成「纯 CLI / 无 UI 的 headless 模式」，可把 `services/` 抽到 `packages/core/`，桌面端与 CLI 共用——v1 不必先做。

---

## 3. MCP 服务在架构中的位置

```
Renderer（设置页：MCP 开关 + 端口）
    │ IPC: mcp:getStatus / mcp:setConfig / mcp:restart
    ▼
Main index.ts
    └── services/mcp/lifecycle.ts
            ├── enabled=false → 不 listen
            └── enabled=true  → Hono + @hono/node-server @ :8276/mcp
```

### MCP 层代码结构（Hono）

```
main/services/mcp/
├── server.ts       # 创建 Hono app，注册路由
├── routes/
│   ├── mcp.ts      # /mcp → MCP transport
│   └── health.ts   # GET /health
├── tools/          # MCP tool handlers
└── lifecycle.ts    # start() / stop() / restart()
```

依赖（v1）：

```json
{
  "hono": "^4",
  "@hono/node-server": "^1",
  "@modelcontextprotocol/server": "latest",
  "@modelcontextprotocol/hono": "latest"
}
```

MCP SDK 提供 **`WebStandardStreamableHTTPServerTransport`** + **`createMcpHonoApp`**，与 Hono 的 Web Standard `Request/Response` 模型一致，无需 Express。

```typescript
// 示意（实现阶段）
import { serve } from '@hono/node-server'
import { McpServer, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { createMcpHonoApp } from '@modelcontextprotocol/hono'

const mcpServer = new McpServer({ name: 'dochub', version: '1.0.0' })
const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
await mcpServer.connect(transport)

const app = createMcpHonoApp()
app.get('/health', (c) => c.json({ status: 'ok', /* ... */ }))
app.all('/mcp', (c) => transport.handleRequest(c.req.raw))

// lifecycle.start(port) → serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 8276 })
```

路由详情见 [http-api.md](./http-api.md)。

MCP **必须支持 UI 开关**：用户可关闭以减少暴露面；关闭后 Cursor 连不上，托盘应显示「MCP 已关闭」。

---

## 4. 模块职责速查

| 目录 | 职责 |
|------|------|
| `main/services/mcp` | Hono：`/mcp` + `/health`、启停 |
| `main/services/source` | 源配置、同步任务队列 |
| `main/services/discovery` | URL 发现 |
| `main/services/crawler` | HTTP/Playwright 抓取 |
| `main/services/converter` | mdream 转换 |
| `main/services/indexer` | SQLite FTS |
| `main/services/search` | 关键词/语义检索 |
| `main/ipc` | UI 调主进程的唯一入口 |
| `renderer/pages` | 含 **设置 → MCP** 页 |
| `shared/types` | `McpConfig`、`McpRuntimeStatus` |

---

## 5. 相关文档

- [http-api.md](./http-api.md)
- [architecture.md](./architecture.md)
- [config.md](./config.md) — `mcp.enabled` / `port`
- [v1 PRD](../v1/prd.md)
