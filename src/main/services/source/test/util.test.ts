import { describe, expect, it } from 'vitest'
import { existsSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseAppConfig } from '@shared/types/config'
import { ensureDataDirs } from '../../../config/load'
import { deleteSourceRecord } from '../store'
import { isInScope, urlToDocPath } from '../util'

describe('isInScope', () => {
  it('matches path-only prefix on same site', () => {
    expect(isInScope('https://electron-vite.org/guide/', '/guide/')).toBe(true)
    expect(isInScope('https://electron-vite.org/guide/getting-started', '/guide/')).toBe(true)
    expect(isInScope('https://electron-vite.org/blog/', '/guide/')).toBe(false)
  })
})

describe('urlToDocPath', () => {
  it('maps guide index with path-only prefix', () => {
    expect(urlToDocPath('https://electron-vite.org/guide/', '/guide/')).toBe('docs/index.md')
  })
})

describe('source id guard', () => {
  it('rejects path traversal source IDs before deleting files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dochub-source-id-'))
    const config = parseAppConfig({ dataDir: dir })
    await ensureDataDirs(config)

    await expect(deleteSourceRecord('..', config)).rejects.toThrow('无效的文档源 ID')
    expect(existsSync(dir)).toBe(true)

    await rm(dir, { recursive: true, force: true })
  })
})
