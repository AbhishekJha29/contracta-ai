import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/github/disconnect - Disconnects GitHub account from current logged-in user
 */
export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        githubId: null,
        githubUsername: null,
        accessToken: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'GitHub account disconnected successfully.',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        githubId: null,
        githubUsername: null,
      },
    });
  } catch (error: any) {
    console.error('[API /api/auth/github/disconnect] Error disconnecting GitHub:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to disconnect GitHub account.' },
      { status: 500 }
    );
  }
}
