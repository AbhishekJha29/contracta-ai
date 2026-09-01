import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/profile - Returns real-time user profile & GitHub connection state from DB
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id && !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ id: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        hasGitHub: Boolean(user.githubId && user.accessToken),
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[API /api/user/profile] Error fetching profile:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch user profile.' },
      { status: 500 }
    );
  }
}
