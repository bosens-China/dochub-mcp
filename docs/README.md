# DocHub 文档索引

DocHub 是个人本地知识库客户端：将网站文档镜像到 `~/dochub/`，通过 MCP 向 Cursor 等 AI 编辑器暴露检索与阅读能力。

## 目录结构

```
docs/
├── README.md          # 本文件
├── shared/            # 跨版本公共文档（架构、配置、API 等）
├── v1/                # v1 范围：PRD + 实现清单
├── v2/                # v2 增量：PRD + 实现清单
└── v3/                # v3 规划：PRD + 实现清单
```

> **原则：** 只有随版本变化的 **PRD** 与 **Todo** 放在 `v1/`、`v2/`、`v3/`；其余公共模块统一在 `shared/`。

## 公共文档（shared/）

| 文档 | 说明 |
|------|------|
| [project-structure](./shared/project-structure.md) | 代码目录、Hono/MCP 位置 |
| [tech-stack](./shared/tech-stack.md) | 技术选型与第三方对比 |
| [architecture](./shared/architecture.md) | 系统架构 |
| [http-api](./shared/http-api.md) | Hono 路由（`/mcp`、`/health`） |
| [mcp-tools](./shared/mcp-tools.md) | MCP 工具定义 |
| [data-model](./shared/data-model.md) | 数据模型与 `~/dochub` 结构 |
| [config](./shared/config.md) | 配置项 reference |
| [spa-detection](./shared/spa-detection.md) | SPA/SSR 侦测策略 |

## 版本文档

| 版本 | 目标 | 文档 |
|------|------|------|
| **v1** | 本地知识库 + 关键词检索 + MCP（无需 Ollama） | [prd](./v1/prd.md) · [todo](./v1/todo.md) |
| **v2** | Ollama 语义检索 / Rerank / SPA / 定时同步 | [prd](./v2/prd.md) · [todo](./v2/todo.md) |
| **v3** | 站点适配器、导出备份、鉴权增强 | [prd](./v3/prd.md) · [todo](./v3/todo.md) |

## 阅读顺序

1. [v1 PRD](./v1/prd.md) — 产品范围与验收标准
2. [project-structure](./shared/project-structure.md) — 代码放哪
3. [tech-stack](./shared/tech-stack.md) — 用什么技术
4. [architecture](./shared/architecture.md) — 怎么串起来
5. [data-model](./shared/data-model.md) + [config](./shared/config.md)
6. [mcp-tools](./shared/mcp-tools.md) + [http-api](./shared/http-api.md)
7. [v1 Todo](./v1/todo.md) — 实现清单

后续版本只看对应 `v2/prd.md`、`v3/prd.md` 增量即可。
