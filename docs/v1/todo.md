# DocHub v1 实现清单

> 按模块分组，`- [ ]` 为待完成，`- [x]` 为已完成。

---

## 基础设施

- [x] Electron 项目目录：`src/main/services/` 骨架（见 [project-structure.md](../shared/project-structure.md)）
- [x] 主进程 / 渲染进程 / shared 模块划分
- [x] `~/dochub` 数据目录初始化与迁移逻辑
- [x] 全局配置读写（`config.json`）
- [x] 日志系统（文件 + 渲染进程展示）

## 数据层

- [x] Source 数据模型 CRUD
- [x] 文档文件读写（层级 MD 存储）
- [x] `_meta.json` / `_tree.txt` 生成与更新
- [x] SQLite FTS5 索引初始化
- [x] Chunk 切分器（整篇优先，10000 字符阈值，语义段落切）
- [x] content hash 计算与对比
- [x] 同步 checkpoint 持久化
- [x] 同步日志存储

## URL 发现

- [x] seed URL 解析（domain + path_prefix scope）
- [x] 站点元信息抓取（title、charset、lang）
- [x] `llms-full.txt` / `llms.txt` 发现与解析
- [x] llms 解析失败 → 跳过逻辑
- [x] `sitemap.xml` 发现与 URL 提取
- [x] scope 内 URL 过滤
- [x] BFS 链接跟随（SSR，限 scope 前缀）
- [x] 域名级 discovery 缓存（同域名多源复用）
- [x] SPA 特征检测（首屏启发式，见 spa-detection.md）
- [x] 添加源：首屏预览 + 用户确认 crawl.mode
- [x] v1：likely_spa 警告 + needs_spa 标记

## 爬取引擎（SSR）

- [x] Crawl Orchestrator（并发队列、间隔调度）
- [x] 固定 / 随机请求间隔（`rateLimit.mode`）
- [x] robots Crawl-delay 与 rateLimit 取 max
- [x] HTTP 客户端 undici（customHeaders、timeout、redirect）
- [x] robots.txt 解析与开关
- [x] 429 Retry-After 处理
- [x] @mdream/js HTML → MD（turndown fallback）
- [ ] Readability 预处理（可选，噪声页面）
- [x] 链接本地化改写
- [x] 单 URL 重试（3 次）
- [x] 域名熔断（3 个不同 URL 失败）
- [x] 增量 hash 跳过
- [x] 树 diff 硬删除
- [x] 断点续爬

## 搜索

- [x] FTS 索引构建（同步后 finalize 阶段更新）
- [x] 关键词搜索 API（`docs:search` IPC channel）
- [x] 按源过滤搜索
- [x] 搜索结果 snippet 生成（SQLite FTS5 snippet 函数）
- [x] 搜索页面 UI（关键词输入、debounce、按源筛选、点击跳转浏览页）

## MCP Server

> 实现改用官方 `@modelcontextprotocol/sdk`（内置 `StreamableHTTPServerTransport`）+ Node `http`，
> 取代文档中已废弃的 `@modelcontextprotocol/hono` 方案。见 `src/main/services/mcp/`。

- [x] `@modelcontextprotocol/sdk` + Node `http` 集成（Streamable HTTP，无状态）
- [x] HTTP 服务启停（绑定 127.0.0.1:8276）
- [x] `GET /health` 路由（见 [http-api.md](../shared/http-api.md)）
- [x] 设置页「测试连接」调用 /health
- [x] MCP 开关（`mcp.enabled`）与端口配置 UI，默认端口 **8276**
- [x] 修改端口 / 开关时 MCP 服务 restart
- [x] 托盘显示 MCP 运行状态
- [x] `list_sources`
- [x] `list_source_tree`
- [x] `read_document`
- [x] `search_documents`（keyword only）
- [x] `get_sync_status`（可选）
- [x] semantic / hybrid 模式返回明确错误（引导 v2）

## 客户端 UI

- [x] 源管理页（添加/编辑/删除/同步）
- [x] 文档浏览页（树 + MD 预览，支持从搜索跳转定位）
- [x] 搜索页（关键词检索 + 按源过滤 + snippet 高亮）
- [x] 设置页（数据目录、MCP、爬取、Header、robots）（Header 全局默认待 UI 补全）
- [x] 同步进度与日志页
- [x] 系统托盘（macOS / Windows / Linux）
- [x] 关窗 → 托盘，不退出
- [x] 托盘菜单（打开/状态/退出）

## 测试与发布

- [x] 单元测试：URL scope 过滤、chunk 切分、hash 对比、SPA 检测、导航、站点元信息、discovery 缓存
- [x] 集成测试：完整同步流程（`runner-e2e.test.ts`）
- [ ] MCP 手动测试（Cursor 接入）
- [ ] electron-builder 三平台打包
- [ ] README 安装与 Cursor 配置说明

## 推荐测试站点

- [ ] `https://electron-vite.org/guide/`（path scope + 无 llms.txt 场景）
- [ ] 选一个带 `llms.txt` 的文档站
- [ ] 选一个带 sitemap 的 Docusaurus 站
