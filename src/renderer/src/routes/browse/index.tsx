import { createFileRoute } from '@tanstack/react-router'
import { BrowsePage } from '@renderer/pages/BrowsePage'

export const Route = createFileRoute('/browse/')({
  validateSearch: (search: Record<string, unknown>) => ({
    sourceId: typeof search.sourceId === 'string' ? search.sourceId : undefined,
    path: typeof search.path === 'string' ? search.path : undefined
  }),
  component: BrowsePage
})
