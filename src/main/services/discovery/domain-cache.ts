/**
 * Domain-level discovery cache. Robots.txt / sitemap.xml / llms.txt are
 * per-origin public resources, so when several sources share a domain we fetch
 * each URL at most once per TTL window instead of once per source/sync.
 *
 * Keyed by full URL (these files are public and header-independent); an entry
 * caches the fetched text OR null (not-found / error), so repeated 404s don't
 * re-hit the network.
 */

interface CacheEntry {
  text: string | null
  expiresAt: number
}

const DEFAULT_TTL_MS = 10 * 60 * 1000
const cache = new Map<string, CacheEntry>()

/**
 * Return the cached text for `key`, or run `produce()` (which must resolve to
 * text or null, never throw) and cache the result. In-flight de-duplication is
 * intentionally omitted — syncs of same-domain sources are typically staggered.
 */
export async function cachedText(
  key: string,
  produce: () => Promise<string | null>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<string | null> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.text

  const text = await produce()
  cache.set(key, { text, expiresAt: now + ttlMs })
  return text
}

/** Drop a single origin's cached entries (e.g. after editing a source's headers). */
export function invalidateOrigin(origin: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(origin)) cache.delete(key)
  }
}

/** Clear the whole cache (tests / manual refresh). */
export function clearDomainCache(): void {
  cache.clear()
}
