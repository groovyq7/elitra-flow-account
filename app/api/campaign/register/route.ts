import { NextRequest, NextResponse } from "next/server";
import { addCampaignRegistration } from "@/actions/mongo.action";
import { isAddress } from "viem";

/** Validate a social handle: must be non-empty and reasonably short */
function isValidHandle(handle: string): boolean {
  return typeof handle === "string" && handle.trim().length > 0 && handle.length <= 64;
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
      telegram: telegram.trim(),
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
