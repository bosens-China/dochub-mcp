import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import { parseAppConfig } from '@shared/types/config'
import { ensureDataDirs, saveConfig } from '../../../config/load'
import { createSourceRecord, writeSourceRecord } from '../../source/store'
import { listDocTree, readDocContent } from '../runner'
import { serializeDocFile } from '../../converter/doc-frontmatter'

describe('listDocTree titles', () => {
  it('uses frontmatter title for leaf nodes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dochub-tree-'))
    const config = parseAppConfig({ dataDir: dir })
    await ensureDataDirs(config)
    await saveConfig(config)

    const record = createSourceRecord({
      name: 'Title Test',
      seedUrl: 'https://example.com/docs/',
      crawlMode: 'ssr'
    })
    await writeSourceRecord(record, config)

    const docsDir = join(dir, 'sources', record.id, 'docs', 'guide')
    await mkdir(docsDir, { recursive: true })
    const md = serializeDocFile(
      {
        sourceUrl: 'https://example.com/docs/guide/',
        originalUrl: 'https://example.com/docs/guide/',
        title: 'Getting Started',
        contentHash: 'sha256:abc',
        syncedAt: '2026-06-26T10:00:00.000Z'
      },
      'Welcome to the guide.'
    )
    await writeFile(join(docsDir, 'index.md'), md, 'utf8')

    const flat = await listDocTree(record.id, config)
    const leaf = flat.find((n) => n.isLeaf)
    expect(leaf?.title).toBe('Getting Started')

    const content = await readDocContent(record.id, leaf!.key, config)
    expect(content.title).toBe('Getting Started')
    expect(content.body).toBe('Welcome to the guide.')

    await rm(dir, { recursive: true, force: true })
  })
})
