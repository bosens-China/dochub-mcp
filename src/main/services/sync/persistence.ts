import { appendFile, open, readFile, stat, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import type { AppConfig } from '@shared/types/config'
import type { Checkpoint, SyncLogLine } from '@shared/types'
import { CheckpointSchema } from '@shared/types'
import { getCheckpointPath, getSyncLogPath } from '../../config/paths'

export async function loadCheckpoint(
  sourceId: string,
  config: AppConfig
): Promise<Checkpoint | null> {
  const path = getCheckpointPath(sourceId, config)
  if (!existsSync(path)) return null
  const raw = JSON.parse(await readFile(path, 'utf8')) as unknown
  return CheckpointSchema.parse(raw)
}

export async function saveCheckpoint(checkpoint: Checkpoint, config: AppConfig): Promise<void> {
  const path = getCheckpointPath(checkpoint.sourceId, config)
  await writeFile(path, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8')
}

export async function appendSyncLog(line: SyncLogLine, config: AppConfig): Promise<void> {
  const path = getSyncLogPath(config)
  await appendFile(path, `${JSON.stringify(line)}\n`, 'utf8')
}

export async function readSyncLogs(
  sourceId: string | null,
  config: AppConfig,
  limit = 100
): Promise<SyncLogLine[]> {
  const path = getSyncLogPath(config)
  if (!existsSync(path)) return []

  // Tail-read：只读文件末尾部分，避免大文件全量加载内存
  // 每行日志大约 300~600 字节，取 limit * 800 作为安全裕量
  const { size } = await stat(path)
  const readSize = Math.min(size, limit * 800)
  const offset = size - readSize

  const handle = await open(path, 'r')
  try {
    const buf = Buffer.allocUnsafe(readSize)
    await handle.read(buf, 0, readSize, offset)
    const chunk = buf.toString('utf8')
    // 跳过可能被截断的第一行（offset > 0 时）
    const lines = chunk.split('\n').filter(Boolean)
    const validLines = offset > 0 ? lines.slice(1) : lines

    const parsed = validLines
      .map((l) => {
        try {
          return JSON.parse(l) as SyncLogLine
        } catch {
          return null
        }
      })
      .filter((l): l is SyncLogLine => l !== null)

    const filtered = sourceId ? parsed.filter((l) => l.sourceId === sourceId) : parsed
    return filtered.slice(-limit).reverse()
  } finally {
    await handle.close()
  }
}
export function createCheckpoint(
  sourceId: string,
  pending: string[],
  previousCompleted: Checkpoint['previousCompleted'] = {}
): Checkpoint {
  const now = new Date().toISOString()
  return CheckpointSchema.parse({
    sourceId,
    startedAt: now,
    updatedAt: now,
    status: 'running',
    pending,
    completed: {},
    previousCompleted,
    failed: {},
    domainFailureCount: 0
  })
}
