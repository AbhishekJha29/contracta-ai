import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { listUserRepos } from '@/lib/github/listRepos';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

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

  if (!accessToken || !user?.githubId) {
    return NextResponse.json(
      {
        error: 'github_not_connected',
        message: 'GitHub account is not connected. Please connect your GitHub account in Settings to view and import repositories.',
        repos: [],
      },
      { status: 200 }
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
