import type { AppConfig } from '@shared/types/config'
import type { OllamaVectorIndexStatus } from '@shared/types'
import type { Chunk } from './chunker'
import { getVectorIndexState, indexDocumentVectors } from './vector'

const DEFAULT_CONCURRENCY = 2
const MAX_CONCURRENCY = 8

interface VectorQueueTask {
  key: string
  sourceId: string
  docPath: string
  title: string
  documentHash: string
  chunks: Chunk[]
  config: AppConfig
  sourceVersion: number
  docVersion: number
}

export interface VectorQueueState {
  queuedCount: number
  activeCount: number
  concurrency: number
}

let queue: VectorQueueTask[] = []
let activeCount = 0
let concurrency = DEFAULT_CONCURRENCY
const activeKeys = new Set<string>()
const sourceVersions = new Map<string, number>()
const docVersions = new Map<string, number>()
let idleWaiters: Array<() => void> = []

function clampConcurrency(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONCURRENCY
  return Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(value)))
}

export function vectorQueueConcurrency(config: AppConfig): number {
  return clampConcurrency(config.ollama.embeddingConcurrency)
}

export function configureVectorQueue(config: AppConfig): void {
  concurrency = vectorQueueConcurrency(config)
  pumpQueue()
}

function taskKey(sourceId: string, docPath: string): string {
  return `${sourceId}::${docPath}`
}

function currentSourceVersion(sourceId: string): number {
  return sourceVersions.get(sourceId) ?? 0
}

function docVersionKey(sourceId: string, docPath: string): string {
  return taskKey(sourceId, docPath)
}

function currentDocVersion(sourceId: string, docPath: string): number {
  return docVersions.get(docVersionKey(sourceId, docPath)) ?? 0
}

function isTaskCurrent(task: VectorQueueTask): boolean {
  return (
    task.sourceVersion === currentSourceVersion(task.sourceId) &&
    task.docVersion === currentDocVersion(task.sourceId, task.docPath)
  )
}

function notifyIdleIfNeeded(): void {
  if (queue.length > 0 || activeCount > 0) return

  const waiters = idleWaiters
  idleWaiters = []
  for (const resolve of waiters) {
    resolve()
  }
}

function upsertQueuedTask(task: VectorQueueTask): void {
  const existingIndex = queue.findIndex((item) => item.key === task.key)
  if (existingIndex >= 0) {
    queue[existingIndex] = task
    return
  }
  queue.push(task)
}

async function runTask(task: VectorQueueTask): Promise<void> {
  try {
    if (!isTaskCurrent(task)) return

    await indexDocumentVectors(
      task.sourceId,
      task.docPath,
      task.title,
      task.documentHash,
      task.chunks,
      task.config,
      { shouldContinue: () => isTaskCurrent(task) }
    )
  } finally {
    activeCount -= 1
    activeKeys.delete(task.key)
    pumpQueue()
    notifyIdleIfNeeded()
  }
}

function pumpQueue(): void {
  while (activeCount < concurrency) {
    const nextIndex = queue.findIndex((task) => !activeKeys.has(task.key))
    if (nextIndex < 0) break

    const [task] = queue.splice(nextIndex, 1)
    if (!task || !isTaskCurrent(task)) {
      continue
    }

    activeCount += 1
    activeKeys.add(task.key)
    void runTask(task)
  }
  notifyIdleIfNeeded()
}

export function enqueueDocumentVectorIndex(
  sourceId: string,
  docPath: string,
  title: string,
  documentHash: string,
  chunks: Chunk[],
  config: AppConfig
): void {
  configureVectorQueue(config)

  const model = config.ollama.embeddingModel.trim()
  if (!config.ollama.enabled || !model || chunks.length === 0) {
    notifyIdleIfNeeded()
    return
  }

  upsertQueuedTask({
    key: taskKey(sourceId, docPath),
    sourceId,
    docPath,
    title,
    documentHash,
    chunks,
    config,
    sourceVersion: currentSourceVersion(sourceId),
    docVersion: currentDocVersion(sourceId, docPath)
  })
  pumpQueue()
}

export function cancelSourceVectorIndex(sourceId: string): void {
  sourceVersions.set(sourceId, currentSourceVersion(sourceId) + 1)
  queue = queue.filter((task) => task.sourceId !== sourceId)
  notifyIdleIfNeeded()
}

export function cancelDocumentVectorIndex(sourceId: string, docPath: string): void {
  const key = docVersionKey(sourceId, docPath)
  docVersions.set(key, (docVersions.get(key) ?? 0) + 1)
  queue = queue.filter((task) => task.sourceId !== sourceId || task.docPath !== docPath)
  notifyIdleIfNeeded()
}

export function getVectorQueueState(config?: AppConfig): VectorQueueState {
  return {
    queuedCount: queue.length,
    activeCount,
    concurrency: config ? vectorQueueConcurrency(config) : concurrency
  }
}

export function getVectorIndexStatus(config: AppConfig): OllamaVectorIndexStatus {
  const indexState = getVectorIndexState(config)
  const queueState = getVectorQueueState(config)
  return {
    ...indexState,
    queuedCount: queueState.queuedCount,
    activeCount: queueState.activeCount
  }
}

export function waitForVectorQueueIdle(timeoutMs = 5_000): Promise<void> {
  if (queue.length === 0 && activeCount === 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const waiterRef: { current: (() => void) | null } = { current: null }
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      const waiter = waiterRef.current
      if (waiter) {
        idleWaiters = idleWaiters.filter((item) => item !== waiter)
      }
      reject(new Error('等待向量索引队列空闲超时'))
    }, timeoutMs)
    const waiter = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }
    waiterRef.current = waiter
    idleWaiters.push(waiter)
  })
}
