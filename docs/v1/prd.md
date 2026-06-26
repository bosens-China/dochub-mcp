# DocHub v1 产品需求文档（PRD）

> 版本：v1.0-draft  
> 状态：已定稿  
> 范围：无需 Ollama 即可使用的完整本地知识库 + MCP 接入

---

## 1. 产品概述

### 1.1 定位

DocHub 是**个人本地知识库**桌面客户端。用户添加文档站 URL，DocHub 将站点内容镜像到本地 `~/dochub/`，并通过 MCP（Streamable HTTP）向 Cursor、Claude Code 等 AI 编辑器提供文档树浏览、全文读取与关键词检索能力。

### 1.2 目标用户

- 开发者个人使用
- 需要离线/可控的文档参考，替代或补充 Context7 等云端文档 MCP
- 希望 AI 编辑器直接读取自选的文档源

### 1.3 v1 核心价值

| 能力 | 说明 |
|------|------|
| 本地镜像 | 文档存于用户磁盘，可离线阅读 |
| 路径级抓取 | 只抓 seed URL 前缀下的内容，非整站 |
| 多级 URL 发现 | 站点元信息 → llms.txt → sitemap → BFS |
| 关键词检索 | SQLite FTS，无需 AI |
| MCP 接入 | localhost HTTP，Cursor 即连即用 |
| 断点续爬 | 同步可中断，下次从 checkpoint 继续 |

### 1.4 v1 明确不包含

- 语义向量检索（v2）
- Rerank（v2）
- SPA / Playwright 渲染（v2）
- 定时同步（v2）
- LLM 结构化 llms.txt（v2）
- 查询翻译增强（v2）

---

## 2. 用户故事

### US-01 添加文档源

**作为**开发者，**我希望**输入一个文档页 URL（如 `https://electron-vite.org/guide/`），**以便** DocHub 只抓取该路径下的文档。

**验收标准：**

- [ ] 系统自动生成默认源名称，用户可修改
- [ ] 系统解析 seed URL，建立 path_prefix scope
- [ ] 系统在域名级发现 llms.txt / sitemap，但只收录 scope 内 URL
- [ ] 同一域名可添加多个独立源（如 `/guide/` 与 `/config/`）

### US-02 同步文档

**作为**开发者，**我希望**手动触发同步，**以便**将远端文档保存到本地。

**验收标准：**

- [ ] 支持全量同步与增量同步（基于 content hash）
- [ ] 同步进度可在 UI 查看（总数/完成/失败）
- [ ] 同步中关闭窗口 → 最小化托盘，任务继续
- [ ] 退出应用 → 任务持久化 checkpoint，下次启动可续爬
- [ ] 单 URL 失败重试 3 次，不影响其他 URL
- [ ] 同一域名累计 3 个不同 URL 失败 → 停止该域名剩余爬取
- [ ] 自定义 Header 可配置，不保证解析成功
- [ ] robots.txt 默认遵守，UI 可关闭

### US-03 浏览本地文档

**作为**开发者，**我希望**在客户端查看已同步的文档树，**以便**确认抓取结果。

**验收标准：**

- [ ] 按源展示层级目录树
- [ ] 可预览 MD 内容
- [ ] 显示同步状态、上次同步时间、失败 URL 列表

### US-04 AI 编辑器使用文档

**作为**开发者，**我希望** Cursor 通过 MCP 读取和搜索本地文档，**以便**在编码时引用文档。

**验收标准：**

- [ ] MCP 监听可配置端口，仅绑定 `127.0.0.1`
- [ ] 支持 `list_sources`、`list_source_tree`、`read_document`、`search_documents`
- [ ] 未配置 Ollama 时，`search_documents` 仅 keyword 模式
- [ ] 文档树以文字形式返回，AI 可按路径读取具体 MD

### US-05 增量更新与删除

**作为**开发者，**我希望**再次同步时只更新变化页面，**以便**节省时间和带宽。

**验收标准：**

- [ ] 每页存储 content hash，未变化则跳过
- [ ] 对比文档树，远端已消失的页面 **硬删除**（文件 + 索引）
- [ ] 删除操作写入同步日志

### US-06 托盘常驻

**作为**开发者，**我希望**关闭主窗口后应用仍在托盘运行，**以便** MCP 服务持续可用。

**验收标准：**

- [ ] macOS / Windows / Linux 均支持系统托盘
- [ ] 关闭窗口 = 最小化到托盘，不退出
- [ ] 托盘菜单：打开主窗口、同步状态、退出

---

## 3. 功能需求

### 3.1 URL 发现策略

#### 3.1.1 双层范围模型

| 层级 | 范围 | 用途 |
|------|------|------|
| **Discovery** | 域名根 | 获取 llms.txt、sitemap、robots、站点元信息 |
| **Crawl** | 用户 seed URL 的 path_prefix | 只收录该前缀下的 URL |

**示例：**

- seed URL：`https://electron-vite.org/guide/`
- discovery domain：`https://electron-vite.org`
- crawl scope：`https://electron-vite.org/guide/`

#### 3.1.2 发现优先级

| 优先级 | 来源 | 说明 |
|--------|------|------|
| P0 | seed URL | 起始页，必抓 |
| P1 | 站点元信息 | title、charset、语言等 |
| P2 | `llms-full.txt` → `llms.txt` | 域名根，过滤到 scope 内；有 full 优先 full |
| P3 | `sitemap.xml` | 域名级，过滤到 scope 内 |
| P4 | 页面内链接 BFS | SSR 解析后提取，限 scope 前缀 |

#### 3.1.3 llms.txt 处理（v1）

- 尝试标准格式解析
- 解析失败 → **跳过**，走 sitemap + BFS（不阻塞、不报错退出）
- LLM 结构化补全 → **v2**

#### 3.1.4 SPA / SSR 侦测与确认

无法事先知道文档站是否为 SPA。采用 **自动侦测 + 首屏预览 + 用户确认（可覆盖）**：

1. 添加源后，**SSR 抓取 seed URL 首屏**
2. 运行启发式评分 → `likely_ssr` | `uncertain` | `likely_spa`
3. `uncertain` / `likely_spa` → UI 弹窗展示 MD 预览与侦测依据，用户选择 `auto` | `ssr` | `spa`
4. `likely_ssr` → 默认不弹窗，直接继续（可在设置强制「总是确认」）
5. 结论写入 `_source.json`，后续同步沿用，设置页可「重新检测」

**v1：** 无 Playwright；选 SPA 或侦测为 SPA 时警告并仍以 SSR 试抓，标记 `needs_spa`。  
**v2：** `spa` / `auto` 联动 Playwright，支持按页 fallback。

详见 [spa-detection.md](../shared/spa-detection.md)。

### 3.2 爬取引擎（v1：SSR only）

| 能力 | v1 行为 |
|------|---------|
| SSR 页面 | HTTP GET + Cheerio 解析 |
| SPA 页面 | v1 不渲染 JS；首屏侦测 + 用户确认模式，标记 `needs_spa`；v2 Playwright |
| HTML → MD | **mdream**（`@mdream/js`）转换；噪声页可选 Readability 预处理 |
| 链接改写 | 站内链接 → 本地相对路径；站外保留原 URL |
| 并发 | 可配置 `crawl.concurrency`，默认 3 |
| 请求间隔 | 可配置固定或**随机间隔**（`rateLimit.mode`），默认 random 300–1500ms |
| 其他 | timeout、User-Agent、excludePatterns 等见 [config.md](../shared/config.md) |

### 3.3 存储与索引

- 文档按 URL path 层级存为 MD 文件
- 每源维护 `_meta.json`、`_tree.txt`
- SQLite FTS5 关键词索引
- 每页 content hash 用于增量对比

详见 [data-model.md](../shared/data-model.md)。

### 3.4 Chunk 策略（v1 索引粒度）

- **优先整篇**：单文档未超阈值 → 1 个索引单元
- **超出阈值**：按段落 / 标题语义切分
- **默认阈值**：10000 字符（可配置 `chunk.maxChars`）

> v1 无向量索引，chunk 主要用于 FTS 片段与 v2 向量索引预埋。

### 3.5 搜索（v1）

| 模式 | 条件 | 说明 |
|------|------|------|
| `keyword` | 始终可用 | SQLite FTS5 全文检索 |
| `semantic` | v2 | v1 调用返回错误提示 |
| `hybrid` | v2 | v1 调用返回错误提示 |

**跨语言说明（v1）：**

- 关键词检索不支持跨语言（中文 query 无法匹配英文文档）
- 此限制在 v2 通过多语 embed + 可选查询翻译缓解

### 3.6 MCP 与 HTTP 服务（Hono）

- 框架：**Hono** + `@modelcontextprotocol/hono` + `@hono/node-server`
- 传输：**Streamable HTTP** → `POST/GET/DELETE /mcp`
- 健康检查：**REST** → `GET /health`（设置页「测试连接」、托盘诊断）
- 绑定：`127.0.0.1:{port}`，默认端口 **8276**，`mcp.enabled` 可在 UI 关闭
- 随应用启动（`autoStart`），托盘常驻期间持续服务
- MCP 工具定义见 [mcp-tools.md](../shared/mcp-tools.md)；HTTP 路由见 [http-api.md](../shared/http-api.md)

### 3.7 客户端 UI

| 页面 | 功能 |
|------|------|
| 源管理 | 添加/编辑/删除源、触发同步、查看状态 |
| 文档浏览 | 树形目录、MD 预览 |
| 设置 | 数据目录、**MCP 开关与端口（默认 8276）**、**测试连接（/health）**、爬取参数、Header、robots 开关 |
| 同步日志 | 成功/失败/跳过/删除记录 |
| 托盘 | MCP 运行状态、同步状态、快捷操作、退出 |

---

## 4. 爬取失败与熔断规则

```
单 URL：
  请求 → 失败 → 重试（最多 3 次）→ 仍失败 → 标记 failed，继续其他 URL

域名级熔断：
  同一域名内，累计 3 个不同 URL 失败（各自重试 3 次后）
  → 停止该域名剩余 URL
  → 源状态 = domain_halted
  → UI / 日志可查看失败原因

断点续爬：
  checkpoint 持久化 pending / completed / failed URL 列表
  应用重启后从 pending 继续
```

---

## 5. 非功能需求

| 类别 | 要求 |
|------|------|
| 隐私 | 数据默认不出本机 |
| 安全 | MCP 仅 localhost；可选 access token（v2） |
| 性能 | 1000 页库，关键词搜索 < 200ms |
| 可靠性 | 同步可中断续传；索引与文件原子更新 |
| 合规 | robots.txt 默认开启，用户可关闭 |
| 跨平台 | macOS / Windows / Linux 同期支持托盘 |

---

## 6. 已知限制（v1）

1. 不支持 JS 渲染站点（SPA 需 v2 Playwright）
2. 不支持语义 / 跨语言检索（需 v2 Ollama）
3. llms.txt 非标准格式时跳过，不做 LLM 补全
4. 自定义 Header 不保证绕过鉴权
5. 定时同步在 v2 提供

---

## 7. 相关文档

- [shared/](../shared/) — 架构、配置、API、数据模型等公共文档
- [todo.md](./todo.md)
- [v2 PRD](../v2/prd.md)
