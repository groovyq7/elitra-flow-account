// Simple in-memory cache for Next.js API routes
// Not persistent across server restarts, but works for most Vercel/Node setups
//
// NOTE: This is a per-process/per-instance cache. In serverless deployments
// (e.g. Vercel Edge Functions) each cold-start gets its own empty cache.
// For a shared cache across instances, use Redis or a similar external store.

interface CacheEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any; // Generic cache — callers provide typed values, JSON.stringify-safe objects
  timestamp: number;
  insertOrder: number; // Used for FIFO eviction when the cache is full
}

const CACHE: Record<string, CacheEntry> = {};
const ONE_HOUR = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 100; // Max entries; oldest-inserted entry is evicted when exceeded
let insertCounter = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCached(key: string): any | undefined {
  const entry = CACHE[key];
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > ONE_HOUR) {
    delete CACHE[key];
    return undefined;
  }
  return entry.value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setCached(key: string, value: any): void {
  // Evict the oldest entry (by insertion order) if we're at the size limit
  // and we're adding a brand-new key (not updating an existing one).
  if (!(key in CACHE) && Object.keys(CACHE).length >= MAX_CACHE_SIZE) {
    let oldestKey: string | undefined;
    let oldestOrder = Infinity;
    for (const [k, entry] of Object.entries(CACHE)) {
      if (entry.insertOrder < oldestOrder) {
        oldestOrder = entry.insertOrder;
        oldestKey = k;
      }
    }
    if (oldestKey) delete CACHE[oldestKey];
  }

  CACHE[key] = { value, timestamp: Date.now(), insertOrder: insertCounter++ };
}
