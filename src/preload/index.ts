import { contextBridge } from 'electron'
import { createDocHubAPI } from './create-api'

const api = createDocHubAPI()

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  throw new Error('DocHub 要求 contextIsolation 为 true')
}
