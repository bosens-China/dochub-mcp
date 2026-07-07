import { z } from 'zod'
import type { SearchResult } from '@shared/types'
import type { OllamaConfig } from '@shared/types/config'
import { chatWithOllama } from './client'

const RerankItemSchema = z.object({
  index: z.number().int().min(0),
  score: z.number().min(0).max(1)
})

const RerankResponseSchema = z
  .union([
    z.array(RerankItemSchema),
    z.object({
      results: z.array(RerankItemSchema)
    })
  ])
  .transform((value) => (Array.isArray(value) ? value : value.results))

export interface RerankOverrides {
  enabled?: boolean
  minScore?: number
}

function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function cleanSnippet(snippet: string): string {
  return snippet
    .replace(/<\/?b>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function candidateText(result: SearchResult, index: number): string {
  return [
    `#${index}`,
    `Title: ${result.title}`,
    `Source: ${result.sourceName}`,
    `Path: ${result.docPath}`,
    `Snippet: ${cleanSnippet(result.snippet).slice(0, 800)}`
  ].join('\n')
}

function shouldRerank(config: OllamaConfig, overrides: RerankOverrides): boolean {
  return overrides.enabled ?? config.rerank.enabled
}

export async function rerankSearchResults(
  query: string,
  results: SearchResult[],
  config: OllamaConfig,
  overrides: RerankOverrides = {}
): Promise<SearchResult[]> {
  if (!shouldRerank(config, overrides) || !config.enabled || results.length === 0) {
    return results
  }

  const topK = Math.min(config.rerank.topK, results.length)
  const candidates = results.slice(0, topK)
  const minScore = normalizeScore(overrides.minScore ?? config.rerank.minScore)

  try {
    const content = await chatWithOllama(
      config,
      [
        {
          role: 'system',
          content:
            'Rerank documentation search candidates for the user query. Return JSON only: {"results":[{"index":0,"score":0.95}]}. Scores must be 0 to 1 relevance values.'
        },
        {
          role: 'user',
          content: [`Query: ${query}`, '', ...candidates.map(candidateText)].join('\n')
        }
      ],
      { format: 'json', model: config.rerank.model }
    )
    const parsed = JSON.parse(content) as unknown
    const scored = RerankResponseSchema.parse(parsed)
    const byIndex = new Map(scored.map((item) => [item.index, normalizeScore(item.score)]))
    const reranked = candidates
      .map((result, index) => {
        const score = byIndex.get(index)
        return score === undefined ? null : { result, score }
      })
      .filter((item): item is { result: SearchResult; score: number } => item !== null)
      .filter((item) => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .map(({ result, score }) => ({
        ...result,
        score
      }))

    return reranked.length > 0 ? reranked : results
  } catch {
    return results
  }
}
