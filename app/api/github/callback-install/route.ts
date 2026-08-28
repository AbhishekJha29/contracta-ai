import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Legacy GitHub App Installation Callback Route.
 * Deprecated: Contracta uses standard GitHub OAuth via Auth.js.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Route deprecated. Contracta uses standard GitHub OAuth.' },
    { status: 404 }
  );
}
