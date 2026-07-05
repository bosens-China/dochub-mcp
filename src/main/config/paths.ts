import { homedir } from 'os'
import { join } from 'path'
import type { AppConfig } from '@shared/types/config'
import { parseAppConfig } from '@shared/types/config'

export const DEFAULT_CONFIG: AppConfig = parseAppConfig({})

export function expandPath(input: string): string {
  if (input.startsWith('~/')) {
    return join(homedir(), input.slice(2))
  }
  return input
}

export function getDataDir(config: AppConfig = DEFAULT_CONFIG): string {
  return expandPath(config.dataDir)
}

export function getConfigPath(config: AppConfig = DEFAULT_CONFIG): string {
  return join(getDataDir(config), 'config.json')
}

export function getSourcesDir(config: AppConfig = DEFAULT_CONFIG): string {
  return join(getDataDir(config), 'sources')
}

export function getSourceDir(sourceId: string, config?: AppConfig): string {
  return join(getSourcesDir(config), sourceId)
}

export function getIndexDir(config: AppConfig = DEFAULT_CONFIG): string {
  return join(getDataDir(config), '.index')
}

export function getFtsPath(config: AppConfig = DEFAULT_CONFIG): string {
  return join(getIndexDir(config), 'fts.db')
}

export function getCheckpointPath(sourceId: string, config: AppConfig = DEFAULT_CONFIG): string {
  return join(getIndexDir(config), 'checkpoints', `${sourceId}.json`)
}

export function getSyncLogPath(config: AppConfig = DEFAULT_CONFIG): string {
  return join(getDataDir(config), 'sync.log.jsonl')
}

export function getAppLogPath(config: AppConfig = DEFAULT_CONFIG): string {
  return join(getDataDir(config), 'app.log.jsonl')
}
