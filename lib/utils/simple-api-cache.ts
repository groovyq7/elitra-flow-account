// Simple in-memory cache for Next.js API routes
// Not persistent across server restarts, but works for most Vercel/Node setups

interface CacheEntry {
  value: any;
  timestamp: number;
}

const CACHE: Record<string, CacheEntry> = {};
const ONE_HOUR = 60 * 60 * 1000;

export function getCached(key: string): any | undefined {
  const entry = CACHE[key];
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > ONE_HOUR) {
    delete CACHE[key];
    return undefined;
  }
  return entry.value;
}

export function setCached(key: string, value: any): void {
  CACHE[key] = { value, timestamp: Date.now() };
}
