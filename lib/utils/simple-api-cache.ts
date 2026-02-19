// Simple in-memory cache for Next.js API routes
// Not persistent across server restarts, but works for most Vercel/Node setups

interface CacheEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any; // Generic cache — callers provide typed values, JSON.stringify-safe objects
  timestamp: number;
}

const CACHE: Record<string, CacheEntry> = {};
const ONE_HOUR = 60 * 60 * 1000;

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
  CACHE[key] = { value, timestamp: Date.now() };
}
