import { z } from 'zod'

export const SourceMetaDocumentSchema = z.object({
  url: z.string(),
  path: z.string(),
  title: z.string(),
  contentHash: z.string(),
  syncedAt: z.string()
})

export const SourceMetaNavigationItemSchema = z.object({
  path: z.string(),
  title: z.string(),
  groups: z.array(z.string()).default([]),
  order: z.number()
})

export const SourceMetaSchema = z.object({
  sourceId: z.string(),
  name: z.string(),
  seedUrl: z.string(),
  scopePrefix: z.string(),
  origin: z.string(),
  updatedAt: z.string(),
  pageCount: z.number(),
  urlIndex: z.record(z.string(), z.string()),
  documents: z.array(SourceMetaDocumentSchema),
  navigation: z.array(SourceMetaNavigationItemSchema).default([])
})

export type SourceMetaDocument = z.infer<typeof SourceMetaDocumentSchema>
export type SourceMetaNavigationItem = z.infer<typeof SourceMetaNavigationItemSchema>
export type SourceMeta = z.infer<typeof SourceMetaSchema>
