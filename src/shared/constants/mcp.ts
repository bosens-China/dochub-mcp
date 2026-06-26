/** MCP defaults — keep in sync with docs/shared/config.md */
export const MCP_DEFAULT_HOST = '127.0.0.1'
export const MCP_DEFAULT_PORT = 8276
export const MCP_DEFAULT_ENABLED = true
export const MCP_DEFAULT_AUTO_START = true

export function mcpEndpoint(host: string, port: number): string {
  return `http://${host}:${port}/mcp`
}

export function mcpHealthUrl(host: string, port: number): string {
  return `http://${host}:${port}/health`
}
