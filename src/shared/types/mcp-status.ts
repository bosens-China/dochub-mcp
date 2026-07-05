/** Runtime status of the local MCP HTTP server (read by UI over IPC, not HTTP). */
export interface McpStatus {
  /** Whether MCP is enabled in config. */
  enabled: boolean
  /** Whether the HTTP server is currently listening. */
  listening: boolean
  host: string
  port: number
  /** MCP endpoint URL to paste into Cursor / Claude Code. */
  endpoint: string
  /** Milliseconds since the HTTP server last started listening (0 when not listening). */
  uptimeMs: number
  /** Last startup error (e.g. EADDRINUSE), or null when healthy. */
  error: string | null
}
