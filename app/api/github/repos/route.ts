import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { listUserRepos } from '@/lib/github/listRepos';
import { prisma } from '@/lib/db/client';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  // 1. Fetch fresh accessToken directly from database (avoiding stale session token)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(session.user.id ? [{ githubId: session.user.id }, { id: session.user.id }] : []),
        ...(session.user.email ? [{ email: session.user.email }] : []),
        ...(session.user.githubUsername ? [{ githubUsername: session.user.githubUsername }] : []),
      ],
    },
  });

  const accessToken = user?.accessToken || session.accessToken;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'GitHub OAuth access token not found. Please sign out and sign in again to refresh permissions.' },
      { status: 403 }
    );
  }

  try {
    const repos = await listUserRepos(accessToken);
    return NextResponse.json({ repos });
  } catch (error: any) {
    console.error('[API /api/github/repos] Failed to fetch repositories:', error?.message || error);
    return NextResponse.json(
      { error: `Failed to fetch repositories from GitHub: ${error.message || error}` },
      { status: 500 }
    );
  }
}
