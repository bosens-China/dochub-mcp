# dochub-mcp

个人本地知识库客户端：镜像网站文档到 `~/dochub/`，通过 MCP 供 Cursor 等 AI 编辑器使用。

## 文档

产品与技术文档见 [docs/](./docs/README.md)（公共文档在 `docs/shared/`，版本 PRD 在 `docs/v1/` 等）。

## 技术栈

Electron + React + TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
