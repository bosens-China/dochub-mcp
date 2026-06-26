import { readFileSync } from 'fs'
import { existsSync } from 'fs'
import { parseAppConfig, type AppConfig } from '@shared/types/config'
import { getConfigPath } from './paths'

export function readConfigSync(): AppConfig {
  const path = getConfigPath()
  if (!existsSync(path)) {
    return parseAppConfig({})
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
  return parseAppConfig(raw)
}
