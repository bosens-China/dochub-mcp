# DocHub 配置项参考

配置文件路径：`~/dochub/config.json`

---

## 完整 Schema

```json
{
  "dataDir": "~/dochub",
  "mcp": {
    "enabled": true,
    "host": "127.0.0.1",
    "port": 8276,
    "autoStart": true
  },
  "chunk": {
    "maxChars": 10000
  },
  "crawl": {
    "respectRobots": true,
    "maxRetriesPerUrl": 3,
    "domainFailureThreshold": 3,
    "concurrency": 3,
    "rateLimit": {
      "mode": "random",
      "fixedMs": 500,
      "randomMinMs": 300,
      "randomMaxMs": 1500
    },
    "requestTimeoutMs": 30000,
    "maxRedirects": 5,
    "userAgent": "DocHub/1.0 (+https://github.com/your-org/dochub-mcp)",
    "defaultHeaders": {}
  },
  "spaDetection": {
    "alwaysConfirm": false,
    "ssrScoreMax": 30,
    "spaScoreMin": 61,
    "minBodyCharsForSsr": 500,
    "autoRetryMinMdChars": 200
  },
  "ollama": {
    "enabled": false
  },
  "ui": {
    "closeToTray": true,
    "language": "zh-CN"
  }
}
```

---

## 字段说明

### 顶层

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `dataDir` | string | `~/dochub` | 数据存储根目录 |

### `mcp`

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enabled` | boolean | `true` | **是否在 UI/运行时开启 MCP 服务**；false 时不监听端口 |
| `host` | string | `127.0.0.1` | 绑定地址，v1 固定 localhost |
| `port` | number | `8276` | MCP 监听端口 |
| `autoStart` | boolean | `true` | 应用启动且 `enabled=true` 时自动启动 MCP |

**UI 行为：**

- 设置页提供 **MCP 开关**（映射 `mcp.enabled`）
- 设置页可编辑 **端口**（修改后若 MCP 已开启则 **重启** 服务）
- 托盘显示：`MCP 运行中 · :8276` / `MCP 已关闭`
- 设置页 **「测试连接」**：请求 `GET http://127.0.0.1:{port}/health`（见 [http-api.md](./http-api.md)）
- 关闭 MCP 不影响本地爬取与文档浏览，仅 Cursor 等外部 Host 无法连接

**Cursor 配置示例：**

```json
{
  "mcpServers": {
    "dochub": {
      "url": "http://127.0.0.1:8276/mcp"
    }
  }
}
```

### `chunk`

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `maxChars` | number | `10000` | 单 chunk 最大字符数；超出则按段落/标题语义切分 |

### `crawl` — 全局爬虫配置

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `respectRobots` | boolean | `true` | 是否遵守 robots.txt；UI 可关闭 |
| `maxRetriesPerUrl` | number | `3` | 单 URL 最大重试次数 |
| `domainFailureThreshold` | number | `3` | 域名熔断：累计 N 个不同 URL 失败后停止该域名 |
| `concurrency` | number | `3` | **并发爬取数**（同时 in-flight 的请求/page 数） |
| `rateLimit` | object | 见下 | **请求间隔策略** |
| `requestTimeoutMs` | number | `30000` | 单次请求超时（毫秒） |
| `maxRedirects` | number | `5` | 最大重定向次数 |
| `userAgent` | string | DocHub/1.0 … | User-Agent；空则使用内置默认 |
| `defaultHeaders` | object | `{}` | 全局默认 HTTP Header |

### `crawl.rateLimit` — 请求间隔

控制每个请求**完成之后**到下一个请求**开始之前**的等待时间（与 concurrency 配合使用）。

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `mode` | `"fixed"` \| `"random"` | `"random"` | 间隔模式 |
| `fixedMs` | number | `500` | `mode=fixed` 时固定间隔（毫秒） |
| `randomMinMs` | number | `300` | `mode=random` 时最小间隔（毫秒） |
| `randomMaxMs` | number | `1500` | `mode=random` 时最大间隔（毫秒） |

**行为说明：**

```
mode=fixed  → 每次等待 fixedMs
mode=random → 每次等待 uniform(randomMinMs, randomMaxMs)
```

**与 robots.txt 的关系：**

- 若 robots 声明 `Crawl-delay: N` 且 `respectRobots=true`
- 实际间隔 = `max(robotsCrawlDelay, rateLimit 计算值)`
- robots 优先级更高（取更保守者）

**与 429 的关系：**

- 收到 `Retry-After` header 时，等待指定时间后再重试（不计入 domainFailureThreshold，计入单 URL 重试）

### `spaDetection` — SPA/SSR 侦测

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `alwaysConfirm` | boolean | `false` | 即使侦测为 SSR 也弹窗让用户确认 |
| `ssrScoreMax` | number | `30` | score ≤ 此值 → `likely_ssr` |
| `spaScoreMin` | number | `61` | score ≥ 此值 → `likely_spa` |
| `minBodyCharsForSsr` | number | `500` | 启发式：低于此正文长度倾向 SPA |
| `autoRetryMinMdChars` | number | `200` | v2 `auto` 模式：MD 短于此值且具 SPA 信号则 Playwright 重抓 |

详见 [spa-detection.md](./spa-detection.md)。

**实现伪代码：**

```typescript
async function waitBetweenRequests(config: CrawlConfig, robotsDelayMs?: number) {
  let delay: number
  if (config.rateLimit.mode === 'fixed') {
    delay = config.rateLimit.fixedMs
  } else {
    const { randomMinMs, randomMaxMs } = config.rateLimit
    delay = randomMinMs + Math.random() * (randomMaxMs - randomMinMs)
  }
  if (robotsDelayMs != null) {
    delay = Math.max(delay, robotsDelayMs)
  }
  await sleep(delay)
}
```

---

## 源级覆盖（`_source.json` 内 `crawl`）

源级配置与全局合并，**源级优先**。未设置的字段继承全局。

```json
{
  "crawl": {
    "mode": "auto",
    "concurrency": 5,
    "rateLimit": {
      "mode": "random",
      "randomMinMs": 500,
      "randomMaxMs": 2000
    },
    "respectRobots": true,
    "maxRetriesPerUrl": 3,
    "domainFailureThreshold": 3,
    "customHeaders": {
      "Authorization": "Bearer xxx",
      "Cookie": "session=abc"
    },
    "excludePatterns": ["*/changelog/*", "*/api/*"],
    "maxDepth": null,
    "maxPages": null
  }
}
```

### 源级额外字段

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `mode` | `"auto"` \| `"ssr"` \| `"spa"` | `"auto"` | v1 仅 ssr/auto；v2 spa 生效 |
| `concurrency` | number | 继承全局 | 覆盖全局并发 |
| `rateLimit` | object | 继承全局 | 覆盖全局间隔策略 |
| `customHeaders` | object | `{}` | 与 `defaultHeaders` 合并，源级优先 |
| `excludePatterns` | string[] | `[]` | glob 排除 URL（picomatch 语法） |
| `maxDepth` | number \| null | `null` | BFS 最大深度；null = 不限制 |
| `maxPages` | number \| null | `null` | 最大抓取页数；null = 不限制 |

> 自定义 Header 不保证绕过鉴权或解析成功。

---

## 配置示例

### 保守爬取（避免封 IP）

```json
{
  "crawl": {
    "concurrency": 1,
    "rateLimit": {
      "mode": "random",
      "randomMinMs": 1000,
      "randomMaxMs": 3000
    }
  }
}
```

### 快速同步（内网 / 自有文档站）

```json
{
  "crawl": {
    "concurrency": 8,
    "rateLimit": {
      "mode": "fixed",
      "fixedMs": 100
    }
  }
}
```

### 带鉴权 Header

```json
{
  "crawl": {
    "defaultHeaders": {
      "Authorization": "Bearer your-token"
    }
  }
}
```

---

## `ollama`（v1 占位）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enabled` | boolean | `false` | v1 仅占位，功能在 v2 实现 |

v2 完整 schema 见 [v2/prd.md](../v2/prd.md)。

---

## `ui`

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `closeToTray` | boolean | `true` | 关闭窗口最小化到托盘 |
| `language` | string | `zh-CN` | 客户端 UI 语言 |

---

## 源级定时同步（v2）

```json
{
  "schedule": {
    "enabled": false,
    "interval": 1,
    "unit": "day"
  }
}
```

`unit` 枚举：`hour` | `day` | `week` | `month`

---

## 配置优先级

```
源级 crawl.*  >  全局 config.json crawl.*  >  内置默认值
robots Crawl-delay（若 respectRobots=true）与 rateLimit 取 max
```

---

## 相关文档

- [http-api.md](./http-api.md)
- [project-structure.md](./project-structure.md)
- [spa-detection.md](./spa-detection.md)
- [tech-stack.md](./tech-stack.md) — 技术选型与第三方对比
- [v1 PRD](../v1/prd.md)
- [data-model.md](./data-model.md)
