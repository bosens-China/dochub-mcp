# DocHub v2 实现清单

> 依赖 v1 全部完成。按模块分组。

---

## Ollama 集成

- [x] Ollama 连通性检测（`/api/tags`）
- [x] Embed API 封装（`/api/embed`）
- [x] Chat API 封装（`/api/chat`）
- [x] 配置 UI：baseUrl、embeddingModel、llmModel
- [x] 模型列表拉取与选择
- [x] Ollama 不可达降级逻辑 + UI 提示

## 向量索引

- [x] sqlite-vec 集成
- [x] chunk embed 队列（异步，可配置并发）
- [x] 增量 embed（仅新/变更 chunk）
- [x] embed 失败重试与 `index_pending` 标记
- [x] 向量维度与模型变更时 reindex 提示

## 搜索增强

- [x] 语义搜索（向量 TopK）
- [x] Hybrid 搜索（FTS + 向量 RRF）
- [x] MCP `search_documents` mode 扩展
- [x] 按源过滤（继承 v1）

## Rerank

- [x] Ollama rerank 模型调用封装
- [x] 候选 TopK → rerank → minScore 过滤
- [x] 配置：enabled、model、minScore、topK
- [x] MCP 可选参数 `rerank`、`minScore`

## LLM 增强发现

- [x] llms.txt 解析失败 → LLM 结构化 prompt
- [x] JSON 输出校验与 scope 过滤
- [x] 未启用 Ollama 时跳过（v1 行为）

## SPA 爬取

- [x] Playwright 依赖与 Chromium 打包
- [x] Browser 池 / Page 池管理
- [x] SPA 渲染 → HTML → 现有 converter 流水线
- [x] 源级 crawl.mode：`auto` | `ssr` | `spa`
- [x] 添加源 SPA 侦测 + 确认 UI（v1 侦测，v2 Playwright 联动）
- [x] `auto` 模式按页 Playwright fallback
- [x] 渲染 timeout / waitUntil 可配置

## 定时同步

- [x] Scheduler（Main Process，托盘常驻时运行）
- [x] 源级 schedule 配置 UI
- [x] interval + unit：hour / day / week / month
- [x] 同一源同步锁（不并发）
- [x] 下次执行时间展示

## 跨语言

- [x] 推荐多语 embed 模型 UI 提示
- [x] 单语模型检测与警告
- [x] queryTranslation 配置与实现
- [x] 文档 language 字段写入（可选，检测 HTML lang）

## MCP 扩展

- [x] `search_documents` semantic / hybrid
- [x] `get_ollama_status`（可选）
- [x] Server instructions 更新

## 测试

- [x] Ollama embed + search 集成测试
- [x] Rerank 分数过滤测试
- [ ] SPA 站点端到端（选 1 个 VitePress SPA）
- [ ] 跨语言 query 手动测试（中英各一组）
- [x] 定时同步触发测试
- [x] Ollama 宕机降级测试

## 文档

- [x] 更新 README：Ollama 安装与模型 pull 指南
- [x] 更新 [shared/config.md](../shared/config.md) v2 扩展节
- [x] 更新 [shared/mcp-tools.md](../shared/mcp-tools.md) v2 参数
