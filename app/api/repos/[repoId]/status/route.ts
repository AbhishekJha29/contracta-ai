import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';

/**
 * GET /api/repos/[repoId]/status - Returns the latest analysis baseline status for polling
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  const resolvedParams = await params;
  const repoId = resolvedParams?.repoId;

  if (!repoId) {
    return NextResponse.json({ error: 'Missing required route parameter: repoId.' }, { status: 400 });
  }

  try {
    const repo = await prisma.repo.findFirst({
      where: {
        OR: [{ id: repoId }, { githubRepoId: repoId }],
      },
      include: {
        baselines: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        driftReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!repo) {
      return NextResponse.json({ error: `Repository not found with ID: ${repoId}` }, { status: 404 });
    }

    const latestBaseline = repo.baselines[0] || null;
    const latestDriftReport = repo.driftReports[0] || null;

    return NextResponse.json({
      repoId: repo.id,
      hasBaseline: Boolean(latestBaseline),
      latestVersion: latestBaseline?.version ?? 0,
      latestBaseline,
      hasDriftReport: Boolean(latestDriftReport),
      latestDriftReport,
    });
  } catch (error: any) {
    console.error(`[API /api/repos/${repoId}/status] Failed to fetch repository status:`, error);
    return NextResponse.json(
      { error: `Failed to fetch status: ${error.message || error}` },
      { status: 500 }
    );
  }
}
