import { createServer, type Server } from 'node:http'
import { app } from 'electron'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { AppConfig } from '@shared/types/config'
import type { McpStatus } from '@shared/types'
import { mcpEndpoint } from '@shared/constants/mcp'
import { logger } from '../logger/app-logger'
import { sourceManager } from '../source/manager'
import { buildMcpServer } from './tools'

let httpServer: Server | null = null
let startedAt = 0
let lastError: string | null = null
let currentConfig: AppConfig | null = null

function appVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return '1.0.0'
  }
}

async function sourceStats(): Promise<{ total: number; syncing: number }> {
  try {
    const sources = await sourceManager.listSources()
    const progress = await sourceManager.getSyncProgress()
    const active = Array.isArray(progress) ? progress : progress ? [progress] : []
    return { total: sources.length, syncing: active.length }
  } catch {
    return { total: 0, syncing: 0 }
  }
}

export function getMcpStatus(): McpStatus {
  const cfg = currentConfig
  const host = cfg?.mcp.host ?? '127.0.0.1'
  const port = cfg?.mcp.port ?? 8276
  const listening = httpServer !== null && httpServer.listening
  return {
    enabled: cfg?.mcp.enabled ?? false,
    listening,
    host,
    port,
    endpoint: mcpEndpoint(host, port),
    uptimeMs: listening && startedAt ? Date.now() - startedAt : 0,
    error: lastError
  }
}

async function handleHealth(host: string, port: number): Promise<string> {
  const stats = await sourceStats()
  return JSON.stringify({
    status: 'ok',
    service: 'dochub',
    version: appVersion(),
    uptimeMs: startedAt ? Date.now() - startedAt : 0,
    mcp: {
      enabled: currentConfig?.mcp.enabled ?? true,
      listening: true,
      host,
      port,
      endpoint: mcpEndpoint(host, port)
    },
    dataDir: currentConfig?.dataDir ?? '',
    sources: stats
  })
}

export async function startMcpServer(config: AppConfig): Promise<void> {
  currentConfig = config
  if (!config.mcp.enabled) {
    logger.info('mcp', 'MCP 未启用，跳过启动')
    return
  }
  await stopMcpServer()

  const { host, port } = config.mcp

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://${host}:${port}`)

      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(await handleHealth(host, port))
        return
      }

      if (url.pathname === '/mcp') {
        try {
          // Stateless: a fresh server + transport per request.
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
          res.on('close', () => {
            void transport.close()
          })
          const mcp = buildMcpServer()
          await mcp.connect(transport)
          await transport.handleRequest(req, res)
        } catch (err) {
          logger.error('mcp', '处理 /mcp 请求失败', {
            error: err instanceof Error ? err.message : String(err)
          })
          if (!res.headersSent) {
            res.writeHead(500, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'internal_error' }))
          }
        }
        return
      }

      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not_found' }))
    })()
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      lastError = err.code === 'EADDRINUSE' ? `端口 ${port} 已被占用` : err.message
      logger.error('mcp', 'MCP 服务启动失败', { error: lastError })
      reject(err)
    })
    server.listen(port, host, () => {
      lastError = null
      resolve()
    })
  })

  httpServer = server
  startedAt = Date.now()
  logger.info('mcp', `MCP 服务已启动 ${mcpEndpoint(host, port)}`)
}

export async function stopMcpServer(): Promise<void> {
  if (!httpServer) return
  const server = httpServer
  httpServer = null
  startedAt = 0
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
  logger.info('mcp', 'MCP 服务已停止')
}

export async function restartMcpServer(config: AppConfig): Promise<void> {
  currentConfig = config
  await stopMcpServer()
  if (config.mcp.enabled) {
    try {
      await startMcpServer(config)
    } catch {
      // startMcpServer already logged; status reflects lastError.
    }
  }
}
