# DocHub HTTP API

> 与 MCP 共用同一个 Node `http` 服务、同一端口（默认 **8276**）。
> 仅绑定 `127.0.0.1`，不对外网暴露。

---

## 1. 路由总览

| 方法                      | 路径      | 用途                | 消费者                    |
| ------------------------- | --------- | ------------------- | ------------------------- |
| `GET` / `POST` / `DELETE` | `/mcp`    | MCP Streamable HTTP | Cursor、Claude Code 等    |
| `GET`                     | `/health` | 服务健康与运行状态  | UI 设置页、托盘、本地脚本 |

```
http://127.0.0.1:8276/
├── /mcp      → MCP 协议（见 mcp-tools.md）
└── /health   → REST JSON，非 MCP
```

**注意：** `mcp.enabled=false` 时 **不启动** Node `http` 服务，上述路由均不可达；UI 应通过 **IPC** 读取状态（`mcp:getStatus`）。

---

## 2. `GET /health`

轻量健康检查，供设置页「测试连接」、托盘展示、开发调试。

### 请求

```http
GET /health HTTP/1.1
Host: 127.0.0.1:8276
```

无请求体，无鉴权（v1 localhost only）。

### 响应 `200 OK`

```json
{
  "status": "ok",
  "service": "dochub",
  "version": "1.0.0",
  "uptimeMs": 3600123,
  "mcp": {
    "enabled": true,
    "listening": true,
    "host": "127.0.0.1",
    "port": 8276,
    "endpoint": "http://127.0.0.1:8276/mcp"
  },
  "dataDir": "/Users/me/dochub",
  "sources": {
    "total": 3,
    "syncing": 1
  }
}
```

| 字段              | 说明                                      |
| ----------------- | ----------------------------------------- |
| `status`          | 固定 `"ok"`（服务进程正常且 HTTP 已监听） |
| `version`         | 应用版本号                                |
| `uptimeMs`        | 本次 HTTP 服务启动以来的毫秒数            |
| `mcp.endpoint`    | 供 UI 复制到 Cursor 配置                  |
| `sources.syncing` | 当前正在同步的源数量（可选，便于 UI）     |

### 错误场景

| 情况       | 行为                                             |
| ---------- | ------------------------------------------------ |
| MCP 未开启 | 无 HTTP 监听 → 连接失败；UI 走 IPC               |
| 端口被占用 | 启动失败；IPC 返回 `listening: false` + 错误信息 |

---

## 3. 实现结构

```
main/services/mcp/
├── lifecycle.ts    # Node http server start / stop / restart
├── tools/          # MCP tool  handlers
```

### 示意代码

```typescript
import { createServer } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`)
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(healthPayload))
    return
  }
  if (url.pathname === '/mcp') {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    const mcp = buildMcpServer()
    await mcp.connect(transport)
    await transport.handleRequest(req, res)
    return
  }
  res.writeHead(404).end()
})
```

---

## 4. UI 集成

| 场景                 | 方式                                       |
| -------------------- | ------------------------------------------ |
| 设置页「MCP 已开启」 | IPC `mcp:getStatus`（无需 HTTP）           |
| 设置页「测试连接」   | `fetch('http://127.0.0.1:8276/health')`    |
| 复制 MCP URL         | 从 `/health` 的 `mcp.endpoint` 或 IPC 返回 |
| 托盘状态             | 优先 IPC；可选定时 ping `/health`          |

---

## 5. 未来扩展（v2+，预留）

同一 Node `http` 服务可追加 **内部 REST**，前缀建议 `/api/v1/`：

| 路径                            | 说明        | 阶段 |
| ------------------------------- | ----------- | ---- |
| `GET /api/v1/sources`           | 源列表 JSON | 可选 |
| `POST /api/v1/sources/:id/sync` | 触发同步    | 可选 |

v1 **仅实现** `/mcp` + `/health`，避免与 MCP 职责重叠。

---

## 6. 相关文档

- [mcp-tools.md](./mcp-tools.md) — MCP 工具定义
- [config.md](./config.md) — `mcp.enabled` / `port`
- [project-structure.md](./project-structure.md) — 目录与 MCP 运行时
