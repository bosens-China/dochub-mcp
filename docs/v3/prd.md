# DocHub v3 产品需求文档（PRD）

> 版本：v3.0-draft  
> 状态：规划中  
> 依赖：v1 + v2  
> 范围：生态扩展、高级适配、运维能力

---

## 1. v3 目标

在 v2 完整本地 RAG 知识库基础上，提升**可扩展性、可维护性、企业/重度用户场景**支持。

---

## 2. 规划功能

### 2.1 站点适配器（Site Adapters）

为热门文档框架提供专用解析规则，提升 MD 质量与 URL 发现率。

| 适配器 | 目标站点类型 |
|--------|-------------|
| Docusaurus | 主流开源文档 |
| VitePress | Vue 生态文档 |
| GitBook | SaaS / 自托管 |
| ReadTheDocs | Python 生态 |

**接口：**

```typescript
interface SiteAdapter {
  id: string
  match(url: URL): boolean
  discover?(ctx: DiscoveryContext): string[]
  extractContent?(html: string, url: string): ExtractResult
}
```

### 2.2 导出与备份

- 单源导出为 zip（MD + meta）
- 全库备份 / 恢复
- 索引重建（不重新爬取）

### 2.3 MCP 增强

- 可选 `trigger_sync` 写工具（需 confirmation / destructiveHint）
- Resources：`dochub://{source}/{path}` 直接浏览
- MCP access token 鉴权

### 2.4 鉴权增强

- Cookie 持久化存储（加密）
- Header 模板（按域名保存）
- 登录态检测与 UI 提示

### 2.5 高级爬取

- 并发 / 深度 / 排除 pattern 正则
- 单页应用路由 sitemap 推断
- PDF / OpenAPI spec 等非 HTML 内容（评估）

### 2.6 可观测性

- 同步仪表盘（成功率、耗时、体积）
- 索引健康检查（orphan chunks、hash 不一致）
- 结构化诊断报告导出

### 2.7 插件系统（可选）

- 本地 JS 插件加载适配器
- 插件市场（远期）

---

## 3. 非目标（v3 仍不做）

- 云端同步 / 多设备协作
- 内置 LLM 推理（继续依赖 Ollama）
- 提交到 Anthropic MCP Directory（除非单独规划）

---

## 4. 优先级建议

| 优先级 | 功能 |
|--------|------|
| P0 | 站点适配器（Docusaurus + VitePress） |
| P1 | 导出备份、索引重建 |
| P1 | MCP Resources |
| P2 | Cookie 持久化 |
| P2 | MCP trigger_sync |
| P3 | 插件系统 |

---

## 5. 相关文档

- [v1 PRD](../v1/prd.md)
- [v2 PRD](../v2/prd.md)
- [shared 公共文档](../shared/)
- [todo.md](./todo.md)
