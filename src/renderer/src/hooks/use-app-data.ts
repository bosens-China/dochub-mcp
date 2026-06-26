import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type {
  AddSourceInput,
  AppSettings,
  DocSource,
  DocTreeNode,
  SearchResult,
  SourceDetail,
  SpaDetectionResult,
  SyncLogEntry,
  SyncProgress,
  UpdateSourceInput
} from '@shared/types'
import {
  addSource,
  deleteSource,
  detectSpa,
  fetchDocContent,
  fetchDocTree,
  fetchSettings,
  fetchSource,
  fetchSources,
  fetchSyncLogs,
  fetchSyncProgress,
  searchDocuments,
  testMcpConnection,
  triggerSync,
  updateSettings,
  updateSource
} from '@renderer/lib/ipc-api'
import { queryKeys } from '@renderer/lib/query-client'

export function useSyncProgress(): UseQueryResult<SyncProgress[]> {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.syncProgress,
    queryFn: async () => {
      const prev = queryClient.getQueryData<SyncProgress[]>(queryKeys.syncProgress)
      const next = await fetchSyncProgress()
      if ((prev?.length ?? 0) > 0 && next.length === 0) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sources })
        void queryClient.invalidateQueries({ queryKey: queryKeys.syncLogs })
      }
      return next
    },
    refetchInterval: (query) => ((query.state.data?.length ?? 0) > 0 ? 1000 : 2000)
  })
}

export function useSourceSyncProgress(sourceId: string): SyncProgress | null {
  const { data: progressList = [] } = useSyncProgress()
  return progressList.find((p) => p.sourceId === sourceId) ?? null
}

export function useSources(): UseQueryResult<DocSource[]> {
  const { data: progressList = [] } = useSyncProgress()
  const hasActiveSync = progressList.length > 0

  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: fetchSources,
    refetchInterval: hasActiveSync ? 2000 : false
  })
}

export function useAddSource(): UseMutationResult<DocSource, Error, AddSourceInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AddSourceInput) => addSource(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources })
      void queryClient.invalidateQueries({ queryKey: queryKeys.syncProgress })
      void queryClient.invalidateQueries({ queryKey: queryKeys.syncLogs })
    }
  })
}

export function useUpdateSource(): UseMutationResult<DocSource, Error, UpdateSourceInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSourceInput) => updateSource(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources })
    }
  })
}

export function useSource(id: string | null): UseQueryResult<SourceDetail> {
  return useQuery({
    queryKey: queryKeys.source(id ?? 'none'),
    queryFn: () => fetchSource(id ?? ''),
    enabled: Boolean(id)
  })
}

export function useDetectSpa(): UseMutationResult<SpaDetectionResult, Error, string> {
  return useMutation({
    mutationFn: (seedUrl: string) => detectSpa(seedUrl)
  })
}

export function useDeleteSource(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSource(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources })
    }
  })
}

export function useTriggerSync(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sourceId: string) => triggerSync(sourceId),
    onMutate: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.syncProgress })
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources })
      void queryClient.invalidateQueries({ queryKey: queryKeys.syncProgress })
      void queryClient.invalidateQueries({ queryKey: queryKeys.syncLogs })
    }
  })
}

export function useDocTree(sourceId: string | null): UseQueryResult<DocTreeNode[]> {
  return useQuery({
    queryKey: queryKeys.docTree(sourceId ?? 'none'),
    queryFn: () => fetchDocTree(sourceId ?? ''),
    enabled: Boolean(sourceId)
  })
}

export function useDocContent(
  sourceId: string | null,
  path: string | null
): UseQueryResult<string> {
  return useQuery({
    queryKey: queryKeys.docContent(sourceId ?? 'none', path ?? 'none'),
    queryFn: () => fetchDocContent(sourceId ?? '', path ?? ''),
    enabled: Boolean(sourceId && path)
  })
}

export function useSyncLogs(): UseQueryResult<SyncLogEntry[]> {
  return useQuery({
    queryKey: queryKeys.syncLogs,
    queryFn: fetchSyncLogs
  })
}

export function useSettings(): UseQueryResult<AppSettings> {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: fetchSettings
  })
}

export function useUpdateSettings(): UseMutationResult<AppSettings, Error, Partial<AppSettings>> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<AppSettings>) => updateSettings(partial),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    }
  })
}

export function useTestMcpConnection(): UseMutationResult<
  boolean,
  Error,
  { host: string; port: number }
> {
  return useMutation({
    mutationFn: ({ host, port }: { host: string; port: number }) => testMcpConnection(host, port)
  })
}

export function useSearchDocuments(
  query: string,
  sourceId: string | null
): UseQueryResult<SearchResult[]> {
  return useQuery({
    queryKey: queryKeys.searchResults(query, sourceId),
    queryFn: () => searchDocuments(query, sourceId),
    enabled: query.trim().length > 0,
    staleTime: 10_000
  })
}
