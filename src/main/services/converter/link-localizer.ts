import { posix as pathPosix } from 'node:path'
import { isInScope } from '../source/util'

export interface LinkLocalizeContext {
  currentDocPath: string
  scopePrefix: string
  origin: string
  urlToPath: ReadonlyMap<string, string>
}

const MARKDOWN_LINK_RE = /(!?\[[^\]]*]\()([^)\s]+)(\))/g
const AUTO_LINK_RE = /<(https?:\/\/[^>]+)>/g

export function canonicalPageUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}

function lookupDocPath(href: string, ctx: LinkLocalizeContext): string | null {
  const canonical = canonicalPageUrl(href)
  if (!canonical) return null
  if (!isInScope(canonical, ctx.scopePrefix)) return null

  const direct = ctx.urlToPath.get(canonical)
  if (direct) return direct

  const parsed = new URL(canonical)
  if (!parsed.pathname.endsWith('/')) {
    const withSlash = new URL(`${parsed.pathname}/`, parsed.origin).href
    const hit = ctx.urlToPath.get(withSlash)
    if (hit) return hit
  } else if (parsed.pathname.length > 1) {
    const trimmed = parsed.pathname.replace(/\/$/, '')
    const noSlash = new URL(trimmed, parsed.origin).href
    const hit = ctx.urlToPath.get(noSlash)
    if (hit) return hit
  }

  return null
}

export function relativeDocLink(fromDocPath: string, toDocPath: string): string {
  const from = fromDocPath.replace(/^docs\//, '')
  const to = toDocPath.replace(/^docs\//, '')
  const relDir = pathPosix.relative(pathPosix.dirname(from), pathPosix.dirname(to))
  const file = pathPosix.basename(to)
  if (!relDir || relDir === '.') return `./${file}`
  return `${relDir}/${file}`
}

function localizeHref(href: string, ctx: LinkLocalizeContext): string {
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('mailto:')) {
    return href
  }

  const [targetPart, hashPart] = trimmed.split('#')
  const hash = hashPart ? `#${hashPart}` : ''
  const targetPath = lookupDocPath(targetPart ?? trimmed, ctx)

  if (!targetPath) return href

  const relative = relativeDocLink(ctx.currentDocPath, targetPath)
  return `${relative}${hash}`
}

export function localizeMarkdownLinks(body: string, ctx: LinkLocalizeContext): string {
  let output = body.replace(
    MARKDOWN_LINK_RE,
    (_full, prefix: string, href: string, suffix: string) => {
      return `${prefix}${localizeHref(href, ctx)}${suffix}`
    }
  )

  output = output.replace(AUTO_LINK_RE, (_full, href: string) => {
    const localized = localizeHref(href, ctx)
    return localized === href ? `<${href}>` : localized
  })

  return output
}

export function buildUrlToPathIndex(
  completed: Record<string, { path: string }>
): Map<string, string> {
  const index = new Map<string, string>()
  for (const [url, entry] of Object.entries(completed)) {
    const canonical = canonicalPageUrl(url)
    if (canonical) index.set(canonical, entry.path)
  }
  return index
}
