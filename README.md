# DocHub MCP

个人本地知识库客户端：镜像网站文档到 `~/dochub/`，通过 MCP 供 Cursor 等 AI 编辑器使用。

## 文档

产品与技术文档见 [docs/](./docs/README.md)（公共文档在 `docs/shared/`，版本 PRD 在 `docs/v1/` 等）。

## 技术栈

Electron + React + TypeScript + SQLite FTS5 + MCP Streamable HTTP

## 环境要求

- Node.js 22+
- pnpm 11+

## 安装与开发

```bash
pnpm install
pnpm dev
```

默认数据目录是 `~/dochub`。首次启动后可以在「设置」里调整数据目录、MCP 开关、端口和爬取参数。

SPA 文档站可使用「浏览器抓取」模式；自动模式会先快速抓取，内容过短且疑似 JS 渲染时再用 Playwright 重抓该页面。

## Cursor MCP 配置

DocHub 默认监听 `http://127.0.0.1:8276/mcp`。在 Cursor 的 MCP 配置中加入：

```json
{
  "mcpServers": {
    "dochub": {
      "url": "http://127.0.0.1:8276/mcp"
    }
  }
}
```

如果在设置页修改了端口，请同步修改上面的 URL。可用设置页「测试连接」或访问 `http://127.0.0.1:8276/health` 检查服务状态。

## Ollama（v2 可选）

语义检索、查询翻译和 Rerank 依赖本机 Ollama。安装 Ollama 后可先拉取推荐模型：

```bash
ollama pull nomic-embed-text
ollama pull qwen2.5:3b
ollama pull bge-reranker-v2-m3
```

在 DocHub「设置 → Ollama」里启用后，默认地址为 `http://127.0.0.1:11434`。模型下拉会读取本机 `/api/tags`，也可以手动输入模型名。

同步完成后，文档与关键词搜索会立即可用；向量索引会按设置页的并发数在后台继续 embed，完成后语义检索和 Hybrid 检索可用。

## 构建

当前打包脚本：

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

跨平台分发前仍需要按目标平台准备代码签名、notarization/证书和发布渠道。

## 推荐 IDE

- [VSCode](https://code.visualstudio.com/) + ESLint + Prettier
