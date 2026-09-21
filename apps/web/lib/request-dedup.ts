/**
 * In-flight request deduplication and short-lived caching utility for Next.js / React 19.
 * Prevents duplicate network requests across React StrictMode remounts, NextAuth session transitions,
 * and rapid component re-renders.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const inFlightRequests = new Map<string, Promise<any>>()
const cacheStore = new Map<string, CacheEntry<any>>()

/**
 * Executes a Promise-returning fetcher with in-flight deduplication and optional short-lived caching.
 *
 * @param key Unique cache/dedup key (e.g. `servarr:sonarr:series:254`)
 * @param fetcher Async function returning the data
 * @param options Configuration for deduplication and caching
 * @returns Promise resolving to the fetcher output
 */
export async function dedupGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    force?: boolean
    ttlMs?: number
  }
): Promise<T> {
  const force = options?.force ?? false
  const ttlMs = options?.ttlMs ?? 1500

  // 1. If not forcing fresh fetch, check short-lived cache
  if (!force && ttlMs > 0) {
    const cached = cacheStore.get(key)
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data as T
    }
  }

  // 2. If already in-flight and not forcing, return the existing Promise
  if (!force && inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>
  }

  // 3. Initiate request and deduplicate concurrent callers
  const promise = (async () => {
    try {
      const result = await fetcher()
      if (ttlMs > 0) {
        cacheStore.set(key, { data: result, timestamp: Date.now() })
      }
      return result
    } finally {
      inFlightRequests.delete(key)
    }
  })()

  inFlightRequests.set(key, promise)
  return promise
}

/**
 * Invalidates specific cache keys or all keys matching a prefix.
 *
 * @param keyOrPrefix Exact key or prefix string to invalidate
 */
export function invalidateDedup(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    cacheStore.clear()
    inFlightRequests.clear()
    return
  }

  for (const key of Array.from(cacheStore.keys())) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      cacheStore.delete(key)
    }
  }

  for (const key of Array.from(inFlightRequests.keys())) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      inFlightRequests.delete(key)
    }
  }
}
