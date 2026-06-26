import { z } from 'zod'

export const CheckpointSchema = z.object({
  sourceId: z.string(),
  startedAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(['running', 'paused']),
  pending: z.array(z.string()),
  completed: z.record(
    z.string(),
    z.object({
      hash: z.string(),
      path: z.string()
    })
  ),
  failed: z.record(
    z.string(),
    z.object({
      attempts: z.number(),
      lastError: z.string()
    })
  ),
  domainFailureCount: z.number().default(0)
})

export type Checkpoint = z.infer<typeof CheckpointSchema>

export interface SyncLogLine {
  ts: string
  sourceId: string
  action: 'fetch' | 'skip' | 'update' | 'delete' | 'fail' | 'domain_halt'
  url?: string
  path?: string
  reason?: string
  message?: string
}
