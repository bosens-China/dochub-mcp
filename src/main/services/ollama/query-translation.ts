import { z } from 'zod'
import type { OllamaConfig } from '@shared/types/config'
import { chatWithOllama } from './client'

const MAX_QUERY_VARIANTS = 4

const QueryTranslationSchema = z
  .union([
    z.array(z.string()),
    z.object({
      queries: z.array(z.string()).default([]),
      translations: z.array(z.string()).default([])
    })
  ])
  .transform((value) => (Array.isArray(value) ? value : [...value.queries, ...value.translations]))

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim()
}

function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const query of queries) {
    const normalized = normalizeQuery(query)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
    if (result.length >= MAX_QUERY_VARIANTS) break
  }

  return result
}

export async function buildTranslatedSearchQueries(
  query: string,
  config: OllamaConfig
): Promise<string[]> {
  const original = normalizeQuery(query)
  if (!original) return []
  if (!config.enabled || !config.queryTranslation.enabled || !config.llmModel.trim()) {
    return [original]
  }

  try {
    const content = await chatWithOllama(
      config,
      [
        {
          role: 'system',
          content:
            'You expand search queries for local documentation retrieval. Return JSON only: {"queries":["original or translated query"]}. Include concise English translation when the query is not English, and keep technical identifiers unchanged.'
        },
        { role: 'user', content: original }
      ],
      { format: 'json' }
    )
    const parsed = JSON.parse(content) as unknown
    const translated = QueryTranslationSchema.parse(parsed)
    return uniqueQueries([original, ...translated])
  } catch {
    return [original]
  }
}
