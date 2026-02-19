/**
 * Shared IP-based in-memory rate limiter for Next.js API routes.
 *
 * Usage:
 *   import { createRateLimiter } from "@/lib/utils/rate-limit";
 *
 *   const limiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });
 *
 *   export async function GET(req: Request) {
 *     const ip = req.headers.get("x-forwarded-for") ?? "unknown";
 *     if (limiter.isRateLimited(ip)) {
 *       return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *     }
 *     // ...
 *   }
 *
 * IMPORTANT LIMITATIONS:
 * - State is per-process. Serverless cold-starts (e.g. Vercel) each get a
 *   fresh counter, so this does NOT provide global rate limiting across
 *   instances. For multi-instance protection use Redis / Upstash.
 * - Vercel's built-in Edge Rate Limiting (configured via vercel.json) is the
 *   recommended first line of defence before this utility.
 * - This utility is a best-effort guard for development environments and
 *   single-instance deployments.
 */

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

interface RateLimiterOptions {
  /** Maximum requests allowed per IP within the window. */
  maxRequests: number;
  /** Window duration in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
  /** How often to clean up stale entries (ms). Default: 5 * windowMs. */
  cleanupIntervalMs?: number;
}

export interface RateLimiter {
  /** Returns true if the IP has exceeded the rate limit for this window. */
  isRateLimited(ip: string): boolean;
}

/**
 * Create a new rate limiter instance. Each call returns an independent limiter
 * with its own counter map, so different routes can have different limits.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { maxRequests, windowMs = 60_000, cleanupIntervalMs } = options;
  const effectiveCleanup = cleanupIntervalMs ?? windowMs * 5;

  const ipMap = new Map<string, RateLimitRecord>();
  let lastCleanup = Date.now();

  function cleanup(now: number): void {
    for (const [ip, record] of ipMap.entries()) {
      if (now - record.windowStart > windowMs) {
        ipMap.delete(ip);
      }
    }
  }

  return {
    isRateLimited(ip: string): boolean {
      const now = Date.now();

      // Periodic cleanup to prevent unbounded memory growth.
      if (now - lastCleanup > effectiveCleanup) {
        cleanup(now);
        lastCleanup = now;
      }

      const record = ipMap.get(ip);

      if (!record || now - record.windowStart > windowMs) {
        // New window — start fresh.
        ipMap.set(ip, { count: 1, windowStart: now });
        return false;
      }

      if (record.count >= maxRequests) {
        return true;
      }

      record.count++;
      return false;
    },
  };
}
