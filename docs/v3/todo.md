# DocHub v3 实现清单

> 依赖 v1 + v2 全部完成。优先级见 [prd.md](./prd.md) §4。

---

## 站点适配器

- [ ] SiteAdapter 接口定义
- [ ] 适配器注册与 match 链
- [ ] Docusaurus 适配器
- [ ] VitePress 适配器
- [ ] GitBook 适配器（评估）
- [ ] ReadTheDocs 适配器（评估）
- [ ] UI：自动检测并提示可用适配器

## 导出与备份

- [ ] 单源 zip 导出
- [ ] 全库备份（含 index）
- [ ] 从备份恢复
- [ ] 索引重建 CLI / UI 入口

## MCP 增强

- [ ] Resources：`dochub://` URI 注册
- [ ] `trigger_sync` 写工具 + 确认流程
- [ ] MCP access token 配置

## 鉴权增强

- [ ] Cookie 加密存储（按 domain）
- [ ] Header 模板管理 UI
- [ ] 401/403 检测与提示

## 高级爬取

- [ ] 排除 URL 正则配置
- [ ] 最大深度限制
- [ ] 非 HTML 内容支持评估与 PoC

## 可观测性

- [ ] 同步统计仪表盘
- [ ] 索引一致性检查工具
- [ ] 诊断报告导出

## 插件系统（可选）

- [ ] 插件加载机制设计
- [ ] 示例插件
- [ ] 插件文档

## 文档

- [ ] 适配器开发指南
- [ ] 备份恢复操作手册
