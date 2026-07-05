import { afterEach, describe, expect, it, vi } from 'vitest'
import { cachedText, clearDomainCache, invalidateOrigin } from '../domain-cache'

afterEach(() => {
  clearDomainCache()
  vi.useRealTimers()
})

describe('cachedText', () => {
  it('runs produce once for repeated calls within TTL', async () => {
    let calls = 0
    const produce = async (): Promise<string> => {
      calls += 1
      return 'robots'
    }
    const a = await cachedText('https://x.dev/robots.txt', produce)
    const b = await cachedText('https://x.dev/robots.txt', produce)
    expect(a).toBe('robots')
    expect(b).toBe('robots')
    expect(calls).toBe(1)
  })

  it('caches null results too (avoids refetching 404s)', async () => {
    let calls = 0
    const produce = async (): Promise<string | null> => {
      calls += 1
      return null
    }
    await cachedText('https://x.dev/sitemap.xml', produce)
    const second = await cachedText('https://x.dev/sitemap.xml', produce)
    expect(second).toBeNull()
    expect(calls).toBe(1)
  })

  it('re-runs produce after the TTL expires', async () => {
    vi.useFakeTimers()
    let calls = 0
    const produce = async (): Promise<string> => {
      calls += 1
      return `v${calls}`
    }
    const first = await cachedText('https://x.dev/llms.txt', produce, 1000)
    vi.advanceTimersByTime(1500)
    const second = await cachedText('https://x.dev/llms.txt', produce, 1000)
    expect(first).toBe('v1')
    expect(second).toBe('v2')
    expect(calls).toBe(2)
  })

  it('invalidateOrigin drops only that origin', async () => {
    const produce = (val: string) => async (): Promise<string> => val
    await cachedText('https://a.dev/robots.txt', produce('a'))
    await cachedText('https://b.dev/robots.txt', produce('b'))
    invalidateOrigin('https://a.dev')

    let aCalls = 0
    await cachedText('https://a.dev/robots.txt', async () => {
      aCalls += 1
      return 'a2'
    })
    let bCalls = 0
    await cachedText('https://b.dev/robots.txt', async () => {
      bCalls += 1
      return 'b2'
    })
    expect(aCalls).toBe(1) // a was invalidated → produce ran again
    expect(bCalls).toBe(0) // b still cached
  })
})
