# DocHub v2 实现清单

> 依赖 v1 全部完成。按模块分组。

---

## Ollama 集成

- [ ] Ollama 连通性检测（`/api/tags`）
- [ ] Embed API 封装（`/api/embed`）
- [ ] Chat API 封装（`/api/chat`）
- [ ] 配置 UI：baseUrl、embeddingModel、llmModel
- [ ] 模型列表拉取与选择
- [ ] Ollama 不可达降级逻辑 + UI 提示

## 向量索引

- [ ] sqlite-vec 集成
- [ ] chunk embed 队列（异步，可配置并发）
- [ ] 增量 embed（仅新/变更 chunk）
- [ ] embed 失败重试与 `index_pending` 标记
- [ ] 向量维度与模型变更时 reindex 提示

## 搜索增强

- [ ] 语义搜索（向量 TopK）
- [ ] Hybrid 搜索（FTS + 向量 RRF）
- [ ] MCP `search_documents` mode 扩展
- [ ] 按源过滤（继承 v1）

## Rerank

- [ ] Ollama rerank 模型调用封装
- [ ] 候选 TopK → rerank → minScore 过滤
- [ ] 配置：enabled、model、minScore、topK
- [ ] MCP 可选参数 `rerank`、`minScore`

## LLM 增强发现

- [ ] llms.txt 解析失败 → LLM 结构化 prompt
- [ ] JSON 输出校验与 scope 过滤
- [ ] 未启用 Ollama 时跳过（v1 行为）

## SPA 爬取

- [ ] Playwright 依赖与 Chromium 打包
- [ ] Browser 池 / Page 池管理
- [ ] SPA 渲染 → HTML → 现有 converter 流水线
- [ ] 源级 crawl.mode：`auto` | `ssr` | `spa`
- [ ] 添加源 SPA 侦测 + 确认 UI（v1 侦测，v2 Playwright 联动）
- [ ] `auto` 模式按页 Playwright fallback
- [ ] 渲染 timeout / waitUntil 可配置

## 定时同步

- [ ] Scheduler（Main Process，托盘常驻时运行）
- [ ] 源级 schedule 配置 UI
- [ ] interval + unit：hour / day / week / month
- [ ] 同一源同步锁（不并发）
- [ ] 下次执行时间展示

## 跨语言

- [ ] 推荐多语 embed 模型 UI 提示
- [ ] 单语模型检测与警告
- [ ] queryTranslation 配置与实现
- [ ] 文档 language 字段写入（可选，检测 HTML lang）

## MCP 扩展

- [ ] `search_documents` semantic / hybrid
- [ ] `get_ollama_status`（可选）
- [ ] Server instructions 更新

## 测试

- [ ] Ollama embed + search 集成测试
- [ ] Rerank 分数过滤测试
- [ ] SPA 站点端到端（选 1 个 VitePress SPA）
- [ ] 跨语言 query 手动测试（中英各一组）
- [ ] 定时同步触发测试
- [ ] Ollama 宕机降级测试

## 文档

- [ ] 更新 README：Ollama 安装与模型 pull 指南
- [ ] 更新 [shared/config.md](../shared/config.md) v2 扩展节
- [ ] 更新 [shared/mcp-tools.md](../shared/mcp-tools.md) v2 参数
