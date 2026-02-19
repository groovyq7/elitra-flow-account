/**
 * Campaign registration API route.
 *
 * DATA MINIMIZATION / GDPR NOTE:
 * This endpoint stores the following personal data in MongoDB:
 *   - walletAddress  — pseudonymous (public blockchain address, not directly PII
 *                      but can be linked to identity; treated as personal data)
 *   - xUsername      — social handle (may identify a natural person)
 *   - telegram       — social handle (may identify a natural person)
 *   - created_at     — registration timestamp
 *   - updated_at     — last-updated timestamp
 *
 * Lawful basis: Legitimate interest / contract performance (campaign participation).
 * Retention: Review and purge records when the campaign ends.
 * No passwords, emails, or government identifiers are stored.
 *
 * NOSQL INJECTION NOTE:
 * All user inputs are validated before use:
 *   - walletAddress → validated by viem isAddress() (checksummed hex, no operators)
 *   - xUsername / telegram → validated by isValidHandle() (string, max 64 chars)
 * The MongoDB filter uses only the validated walletAddress as the key.
 * Values are used exclusively in $set (not in query operators), so NoSQL
 * injection via operator injection (e.g. { $gt: "" }) is not possible.
 */
import { NextRequest, NextResponse } from "next/server";
import { addCampaignRegistration } from "@/actions/mongo.action";
import { isAddress } from "viem";

/** Validate a social handle: must be non-empty and reasonably short */
function isValidHandle(handle: string): boolean {
  return typeof handle === "string" && handle.trim().length > 0 && handle.length <= 64;
}

/**
 * Normalise a Telegram handle by ensuring it starts with "@".
 * The UI already adds "@" before submission, but direct API calls may omit it.
 * We normalise here so stored handles are always in "@username" format.
 */
function normaliseTelegramHandle(handle: string): string {
  const trimmed = handle.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

// ── Simple in-memory IP rate limiter ─────────────────────────────────────────
// Allows MAX_REQUESTS per IP within WINDOW_MS.
// NOTE: This resets on each cold-start (serverless). For persistent rate
// limiting across instances, use Redis / Upstash instead.
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 5;

const ipRequests = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = ipRequests.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    ipRequests.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (record.count >= MAX_REQUESTS) {
    return true;
  }

  record.count++;
  return false;
}

// Clean up stale entries periodically to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequests.entries()) {
    if (now - record.windowStart > WINDOW_MS * 2) {
      ipRequests.delete(ip);
    }
  }
}, WINDOW_MS * 5);

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Extract client IP from standard headers (works on Vercel, Cloudflare, etc.)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { xUsername, telegram, walletAddress } = body as {
      xUsername?: unknown;
      telegram?: unknown;
      walletAddress?: unknown;
    };

    // Input validation
    if (
      typeof xUsername !== "string" ||
      typeof telegram !== "string" ||
      typeof walletAddress !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!isValidHandle(xUsername)) {
      return NextResponse.json(
        { error: "Invalid X username" },
        { status: 400 }
      );
    }

    if (!isValidHandle(telegram)) {
      return NextResponse.json(
        { error: "Invalid Telegram handle" },
        { status: 400 }
      );
    }

    if (!isAddress(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    const result = await addCampaignRegistration({
      xUsername: xUsername.trim(),
      telegram: normaliseTelegramHandle(telegram), // Always stored as "@username"
      walletAddress: walletAddress.toLowerCase(),
      created_at: new Date(),
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to save registration" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, updated: !result.upserted },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[campaign/register] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
