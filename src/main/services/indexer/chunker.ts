import type { AppConfig } from '@shared/types/config'

export interface Chunk {
  chunkId: number
  content: string
  charStart: number
  charEnd: number
}

export function splitIntoChunks(body: string, maxChars: number): Chunk[] {
  if (body.length <= maxChars) {
    return [{ chunkId: 0, content: body, charStart: 0, charEnd: body.length }]
  }

  const sections = body.split(/(?=^#{2,3}\s)/m)
  const chunks: Chunk[] = []
  let buffer = ''
  let charStart = 0

  const flush = (content: string): void => {
    if (!content.trim()) return
    chunks.push({
      chunkId: chunks.length,
      content,
      charStart,
      charEnd: charStart + content.length
    })
    charStart += content.length
  }

  for (const section of sections) {
    if ((buffer + section).length <= maxChars) {
      buffer += section
      continue
    }
    if (buffer) flush(buffer)
    buffer = section
    if (buffer.length > maxChars) {
      const paragraphs = buffer.split(/\n\n+/)
      let paraBuf = ''
      for (const p of paragraphs) {
        if ((paraBuf + p).length <= maxChars) {
          paraBuf += (paraBuf ? '\n\n' : '') + p
        } else {
          if (paraBuf) flush(paraBuf)
          paraBuf = p
          while (paraBuf.length > maxChars) {
            flush(paraBuf.slice(0, maxChars))
            paraBuf = paraBuf.slice(maxChars)
          }
        }
      }
      buffer = paraBuf
    }
  }
  if (buffer) flush(buffer)
  return chunks.length > 0
    ? chunks
    : [{ chunkId: 0, content: body, charStart: 0, charEnd: body.length }]
}

export function chunkMaxChars(config: AppConfig): number {
  return config.chunk.maxChars
}
