const FALLBACK_ERROR_TOKENS = [
  'OLLAMA_DISABLED',
  'Ollama 未启用',
  'Ollama HTTP',
  'Ollama embed',
  'fetch failed',
  'Failed to fetch',
  'ECONN',
  'ETIMEDOUT',
  'UND_ERR',
  'AbortError',
  'aborted',
  'offline'
]

export function shouldFallbackToKeywordSearch(err: unknown): boolean {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  if (message.includes('VECTOR_INDEX_NOT_AVAILABLE')) return false
  return FALLBACK_ERROR_TOKENS.some((token) => message.includes(token))
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
