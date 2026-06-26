import { shell } from 'electron'

const BLOCKED_PROTOCOLS = new Set(['javascript:', 'file:', 'data:', 'vbscript:'])

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function parseExternalUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/** Whether a URL may be handed to the OS browser via shell.openExternal. */
export function isSafeExternalUrl(url: URL): boolean {
  const protocol = url.protocol.toLowerCase()
  if (BLOCKED_PROTOCOLS.has(protocol)) return false
  if (protocol === 'https:') return true
  if (protocol === 'http:' && isLocalHost(url.hostname)) return true
  return false
}

/** In-window navigation allowed for the renderer (file:// prod or Vite dev origin). */
export function isAllowedInAppNavigation(url: string, devRendererOrigin: string | null): boolean {
  const parsed = parseExternalUrl(url)
  if (!parsed) return false

  if (parsed.protocol === 'file:') return true

  if (devRendererOrigin) {
    try {
      if (parsed.origin === new URL(devRendererOrigin).origin) return true
    } catch {
      return false
    }
  }

  return false
}

export async function openExternalIfSafe(raw: string): Promise<boolean> {
  const parsed = parseExternalUrl(raw)
  if (!parsed || !isSafeExternalUrl(parsed)) {
    console.warn('[security] Blocked external URL:', raw)
    return false
  }

  await shell.openExternal(parsed.toString())
  return true
}
