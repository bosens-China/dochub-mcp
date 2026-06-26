export interface DocFrontmatter {
  sourceUrl: string
  originalUrl: string
  title: string
  contentHash: string
  syncedAt: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

function parseYamlLine(line: string): { key: string; value: string } | null {
  const match = line.match(/^([\w-]+):\s*(.*)$/)
  if (!match) return null
  return { key: match[1]!, value: match[2]!.trim() }
}

export function parseDocFile(raw: string): { frontmatter: DocFrontmatter; body: string } | null {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) return null

  const yaml = match[1]!
  const body = match[2]!.trim()
  const fields: Record<string, string> = {}
  for (const line of yaml.split('\n')) {
    const parsed = parseYamlLine(line.trim())
    if (parsed) fields[parsed.key] = parsed.value
  }

  const { sourceUrl, originalUrl, title, contentHash, syncedAt } = fields
  if (!sourceUrl || !originalUrl || !title || !contentHash || !syncedAt) {
    return null
  }

  return {
    frontmatter: { sourceUrl, originalUrl, title, contentHash, syncedAt },
    body
  }
}

export function serializeDocFile(frontmatter: DocFrontmatter, body: string): string {
  const safeTitle = frontmatter.title.replace(/\n/g, ' ')
  return `---
sourceUrl: ${frontmatter.sourceUrl}
originalUrl: ${frontmatter.originalUrl}
title: ${safeTitle}
contentHash: ${frontmatter.contentHash}
syncedAt: ${frontmatter.syncedAt}
---

${body.trim()}
`
}

export function extractDocBody(raw: string): string {
  return parseDocFile(raw)?.body ?? raw
}
