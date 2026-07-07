import { mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { parseAppConfig, type AppConfig } from '@shared/types/config'
import { getConfigPath, getDataDir, getIndexDir, getSourcesDir } from './paths'

const emptyConfig = (): AppConfig => parseAppConfig({})

export async function ensureDataDirs(config: AppConfig = emptyConfig()): Promise<void> {
  const dirs = [
    getDataDir(config),
    getSourcesDir(config),
    getIndexDir(config),
    `${getIndexDir(config)}/checkpoints`
  ]
  await Promise.all(dirs.map((d) => mkdir(d, { recursive: true })))
}

export async function loadConfig(): Promise<AppConfig> {
  const path = getConfigPath()
  if (!existsSync(path)) {
    const defaults = emptyConfig()
    await ensureDataDirs(defaults)
    await saveConfig(defaults)
    return defaults
  }
  const raw = JSON.parse(await readFile(path, 'utf8')) as unknown
  return parseAppConfig(raw)
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const path = getConfigPath(config)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

export async function saveConfigReference(config: AppConfig): Promise<void> {
  const defaultPath = getConfigPath()
  const targetPath = getConfigPath(config)
  if (resolve(defaultPath) === resolve(targetPath)) return

  await mkdir(dirname(defaultPath), { recursive: true })
  await writeFile(defaultPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

export function mergeCrawlConfig(
  global: AppConfig['crawl'],
  source?: Partial<AppConfig['crawl']>
): AppConfig['crawl'] {
  if (!source) return global
  return {
    ...global,
    ...source,
    rateLimit: { ...global.rateLimit, ...source.rateLimit },
    defaultHeaders: { ...global.defaultHeaders, ...source.defaultHeaders }
  }
}
