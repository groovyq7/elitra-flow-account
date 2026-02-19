import { backendQuery } from '@/actions/query.action';
import { NextResponse } from 'next/server';
import { createRateLimiter } from "@/lib/utils/rate-limit";

// 30 requests / minute per IP. This route proxies GraphQL to a backend;
// unconstrained calls could burden the external service.
const rateLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });

export async function POST(request: Request) {
  const ip =
    (request.headers as Headers).get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  if (rateLimiter.isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    // Parse the request body as JSON
    const { query, variables } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const result = await backendQuery(query, variables);

    if (result.error) {
      return NextResponse.json(
        { error: result.error.toString() },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}