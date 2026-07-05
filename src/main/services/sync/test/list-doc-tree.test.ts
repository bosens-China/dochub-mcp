import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import { parseAppConfig } from '@shared/types/config'
import { ensureDataDirs, saveConfig } from '../../../config/load'
import { createSourceRecord, sourceMetaPath, writeSourceRecord } from '../../source/store'
import { listDocTree, listNavigationDocTree, readDocContent } from '../runner'
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

  it('uses stored navigation metadata to mirror the original sidebar hierarchy', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dochub-nav-tree-'))
    const config = parseAppConfig({ dataDir: dir })
    await ensureDataDirs(config)
    await saveConfig(config)

    const record = createSourceRecord({
      name: 'Navigation Test',
      seedUrl: 'https://docs.langchain.com/oss/python/langchain/overview',
      crawlMode: 'ssr',
      pathPrefix: '/oss/python/langchain/'
    })
    await writeSourceRecord(record, config)

    const docsRoot = join(dir, 'sources', record.id, 'docs')
    await mkdir(join(docsRoot, 'middleware'), { recursive: true })
    await Promise.all([
      writeFile(join(docsRoot, 'overview.md'), '# Overview\n', 'utf8'),
      writeFile(join(docsRoot, 'install.md'), '# Install\n', 'utf8'),
      writeFile(join(docsRoot, 'quickstart.md'), '# Quickstart\n', 'utf8'),
      writeFile(join(docsRoot, 'middleware', 'overview.md'), '# Middleware\n', 'utf8')
    ])

    await writeFile(
      sourceMetaPath(record.id, config),
      `${JSON.stringify(
        {
          sourceId: record.id,
          name: record.name,
          seedUrl: record.seedUrl,
          scopePrefix: record.scope.prefix,
          origin: record.discovery.domain,
          updatedAt: '2026-06-26T10:00:00.000Z',
          pageCount: 4,
          urlIndex: {},
          documents: [],
          navigation: [
            { path: 'docs/overview.md', title: 'Overview', groups: [], order: 0 },
            { path: 'docs/install.md', title: 'Install', groups: ['Get started'], order: 1 },
            {
              path: 'docs/quickstart.md',
              title: 'Quickstart',
              groups: ['Get started'],
              order: 2
            },
            {
              path: 'docs/middleware/overview.md',
              title: 'Overview',
              groups: ['Middleware'],
              order: 3
            }
          ]
        },
        null,
        2
      )}\n`,
      'utf8'
    )

    const tree = await listNavigationDocTree(record.id, config)

    expect(tree?.map((node) => node.title)).toEqual(['Overview', 'Get started', 'Middleware'])
    expect(tree?.[0]).toMatchObject({
      key: 'docs/overview.md',
      title: 'Overview',
      isLeaf: true
    })
    expect(tree?.[1]?.children?.map((node) => node.title)).toEqual(['Install', 'Quickstart'])
    expect(tree?.[2]?.children?.[0]).toMatchObject({
      key: 'docs/middleware/overview.md',
      title: 'Overview',
      isLeaf: true
    })

    await rm(dir, { recursive: true, force: true })
  })
})
