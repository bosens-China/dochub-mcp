import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1
    }
  }
})

export const queryKeys = {
  sources: ['sources'] as const,
  source: (id: string) => ['sources', id] as const,
  docTree: (sourceId: string) => ['docTree', sourceId] as const,
  docContent: (sourceId: string, path: string) => ['docContent', sourceId, path] as const,
  syncProgress: ['syncProgress'] as const,
  syncLogs: ['syncLogs'] as const,
  settings: ['settings'] as const,
  searchResults: (query: string, sourceId: string | null) => ['search', query, sourceId] as const
}
