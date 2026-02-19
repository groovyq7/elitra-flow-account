import { backendQuery } from '@/actions/query.action';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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