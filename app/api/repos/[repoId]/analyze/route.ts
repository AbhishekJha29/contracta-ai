import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';
import { enqueueAnalysis } from '@/lib/queue/analyzeQueue';
import { checkRateLimit } from '@/lib/ratelimit/checkRateLimit';

/**
 * POST /api/repos/[repoId]/analyze - Enqueues a repository analysis job in the BullMQ queue
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  // 1. Verify user is authenticated
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  const resolvedParams = await params;
  const repoId = resolvedParams?.repoId;

  if (!repoId) {
    return NextResponse.json({ error: 'Missing required route parameter: repoId.' }, { status: 400 });
  }

  // 2. Load the Repo row by repoId (or githubRepoId) via Prisma
  const repo = await prisma.repo.findFirst({
    where: {
      OR: [
        { id: repoId },
        { githubRepoId: repoId },
      ],
    },
    include: {
      installation: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!repo) {
    return NextResponse.json({ error: `Repository not found with ID: ${repoId}` }, { status: 404 });
  }

  // 3. Confirm repository belongs to the signed-in user (prevent unauthorized analysis)
  const repoOwner = repo.installation.user;
  const isOwner =
    (session.user.id && (repoOwner.id === session.user.id || repoOwner.githubId === session.user.id)) ||
    (session.user.email && repoOwner.email === session.user.email) ||
    (session.user.githubUsername && repoOwner.githubUsername === session.user.githubUsername);

  if (!isOwner) {
    return NextResponse.json(
      { error: 'Forbidden: You do not have permission to analyze this repository.' },
      { status: 403 }
    );
  }

  // 4. Retrieve user's GitHub access token to ensure worker will have permissions
  let accessToken = session.accessToken;
  if (!accessToken && repoOwner.accessToken) {
    accessToken = repoOwner.accessToken;
  }

  if (!accessToken) {
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ githubId: session.user.id }, { id: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
          ...(session.user.githubUsername ? [{ githubUsername: session.user.githubUsername }] : []),
        ],
      },
    });
    accessToken = dbUser?.accessToken || undefined;
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: 'GitHub OAuth access token not found. Please sign out and sign in again to refresh permissions.' },
      { status: 403 }
    );
  }

  // 5. Enforce per-user rate limit (max 5 analysis runs per hour)
  const userId = session.user.id || repoOwner.id;
  const isAllowed = await checkRateLimit(userId);
  if (!isAllowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded: Maximum 5 analysis jobs per user per hour. Please wait before triggering another analysis run.',
      },
      { status: 429 }
    );
  }

  try {
    // 6. Enqueue background analysis job
    const jobId = await enqueueAnalysis(repo.id, userId);

    console.log(`[API /api/repos/${repo.id}/analyze] Enqueued background job ${jobId} for ${repo.owner}/${repo.name}`);

    return NextResponse.json({
      status: 'queued',
      jobId,
      repoId: repo.id,
      message: 'Repository analysis queued for background processing.',
    });
  } catch (error: any) {
    console.error(`[API /api/repos/${repo.id}/analyze] Failed to enqueue background job:`, error);
    return NextResponse.json(
      { error: `Failed to enqueue background analysis job: ${error.message || error}` },
      { status: 500 }
    );
  }
}
