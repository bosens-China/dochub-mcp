import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import { parseAppConfig } from '@shared/types/config'
import { ensureDataDirs, saveConfig } from '../../../config/load'
import { createSourceRecord, readSourceRecord, writeSourceRecord } from '../../source/store'
import { listDocTree, readDocFile, runSourceSync } from '../runner'

describe('sync e2e', () => {
  it.skip(
    'discovers, fetches, indexes and builds doc tree (network, run in Electron)',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'dochub-e2e-'))
      const config = parseAppConfig({ dataDir: dir })
      await ensureDataDirs(config)
      await saveConfig(config)

      const record = createSourceRecord({
        name: 'E2E Test',
        seedUrl: 'https://electron-vite.org/guide/',
        crawlMode: 'ssr'
      })
      await writeSourceRecord(record, config)

      await runSourceSync(record.id, config)

      const after = await readSourceRecord(record.id, config)
      expect(after?.sync.status).toBe('completed')
      expect(after?.sync.pageCount).toBeGreaterThan(0)

      const tree = await listDocTree(record.id, config)
      const leaves = tree.filter((n) => n.isLeaf)
      expect(leaves.length).toBeGreaterThan(0)

      const sample = leaves[0]
      expect(sample).toBeDefined()
      const content = await readDocFile(record.id, sample!.key, config)
      expect(content.length).toBeGreaterThan(100)

      await rm(dir, { recursive: true, force: true })
    },
    120_000
  )
})
