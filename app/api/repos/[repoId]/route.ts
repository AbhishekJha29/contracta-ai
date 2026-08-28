import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { repoId } = await params;

  try {
    const repo = await prisma.repo.findFirst({
      where: {
        OR: [{ id: repoId }, { githubRepoId: repoId }],
      },
      include: {
        baselines: {
          orderBy: { version: 'desc' },
        },
        driftReports: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    return NextResponse.json({ repo });
  } catch (error: any) {
    console.error(`[API /api/repos/${repoId}] Failed to load repository:`, error);
    return NextResponse.json(
      { error: `Failed to load repository: ${error.message || error}` },
      { status: 500 }
    );
  }
}
