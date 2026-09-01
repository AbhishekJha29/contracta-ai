import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';
import { getUserOctokit } from '@/lib/github/userOctokit';
import { registerWebhookForRepo } from '@/lib/github/registerWebhook';

export const dynamic = 'force-dynamic';

/**
 * GET /api/repos - Returns all repositories connected by the authenticated user and usage stats
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(session.user.id ? [{ id: session.user.id }] : []),
        ...(session.user.email ? [{ email: session.user.email }] : []),
        ...(session.user.id ? [{ githubId: session.user.id }] : []),
      ],
    },
    include: {
      installations: {
        include: {
          repos: {
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
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({
      repos: [],
      stats: { totalRepos: 0, totalChecks: 0, cleanRepos: 0, breakingRepos: 0 },
    });
  }

  const allRepos = user.installations.flatMap((inst) => inst.repos);
  const repoIds = allRepos.map((r) => r.id);

  // Count total drift checks run across all repos for this user
  const totalChecks = await prisma.driftReport.count({
    where: {
      repoId: { in: repoIds },
    },
  });

  let cleanRepos = 0;
  let breakingRepos = 0;

  for (const repo of allRepos) {
    const latestDrift = repo.driftReports?.[0];
    if (latestDrift?.severity === 'breaking') {
      breakingRepos++;
    } else {
      cleanRepos++;
    }
  }

  return NextResponse.json({
    repos: allRepos,
    stats: {
      totalRepos: allRepos.length,
      totalChecks,
      cleanRepos,
      breakingRepos,
    },
  });
}

/**
 * POST /api/repos - Connects / tracks a new repository for the authenticated user
 *
 * Expected Request Body (JSON):
 * - githubRepoId: string | number (Required, numeric GitHub repository ID)
 * - owner: string (Required, GitHub username or organization login)
 * - name: string (Required, repository name)
 * - defaultBranch?: string (Optional, default: "main")
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Extract repository fields with flexible fallbacks
    const rawRepoId = body.githubRepoId || body.id || body.repoId;
    let owner = typeof body.owner === 'object' && body.owner !== null ? body.owner.login || body.owner.name : body.owner;
    let name = body.name;

    if (!owner && body.fullName) {
      const parts = body.fullName.split('/');
      owner = parts[0];
      if (!name) name = parts[1];
    }

    const defaultBranch = body.defaultBranch || body.default_branch || 'main';

    if (!rawRepoId || !owner || !name) {
      return NextResponse.json(
        {
          error: 'Missing required repository fields. Required: githubRepoId (or id), owner, name.',
          received: { githubRepoId: rawRepoId, owner, name, defaultBranch },
        },
        { status: 400 }
      );
    }

    const githubRepoId = String(rawRepoId);

    // 1. Locate or auto-create the User record in database
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ id: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
          ...(session.user.id ? [{ githubId: session.user.id }] : []),
        ],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: session.user.id || undefined,
          email: session.user.email || null,
          githubId: session.user.githubId || null,
          githubUsername: session.user.githubUsername || null,
          accessToken: session.accessToken || null,
        },
      });
    }

    // 2. Ensure a default user workspace Installation container exists
    const defaultInstallationId = `user-workspace-${user.id}`;
    const installation = await prisma.installation.upsert({
      where: { githubInstallationId: defaultInstallationId },
      update: { userId: user.id },
      create: {
        githubInstallationId: defaultInstallationId,
        userId: user.id,
      },
    });

    // 3. Upsert the Repo row under this Installation (handles already connected repos gracefully)
    const existingRepo = await prisma.repo.findUnique({
      where: {
        installationId_githubRepoId: {
          installationId: installation.id,
          githubRepoId,
        },
      },
      include: {
        baselines: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    let repo;
    let alreadyConnected = false;

    if (existingRepo) {
      alreadyConnected = true;
      repo = await prisma.repo.update({
        where: { id: existingRepo.id },
        data: {
          owner,
          name,
          defaultBranch,
        },
        include: {
          baselines: {
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      });
    } else {
      repo = await prisma.repo.create({
        data: {
          installationId: installation.id,
          githubRepoId,
          owner,
          name,
          defaultBranch,
        },
        include: {
          baselines: {
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      });
    }

    // 4. Automatically register GitHub push webhook on the repository
    const accessToken = user.accessToken || session.accessToken;
    if (accessToken) {
      try {
        const octokit = getUserOctokit(accessToken);
        const webhookId = await registerWebhookForRepo(octokit, repo.owner, repo.name);
        if (webhookId && webhookId !== repo.webhookId) {
          repo = await prisma.repo.update({
            where: { id: repo.id },
            data: { webhookId },
            include: {
              baselines: {
                orderBy: { version: 'desc' },
                take: 1,
              },
            },
          });
        }
      } catch (hookErr: any) {
        console.warn(
          `[API /api/repos POST] Warning: Automatic webhook registration failed for ${repo.owner}/${repo.name}:`,
          hookErr.message || hookErr
        );
      }
    }

    return NextResponse.json({
      repo,
      alreadyConnected,
      message: alreadyConnected
        ? 'Repository was already connected; record updated.'
        : 'Repository successfully connected and push webhook configured.',
    });
  } catch (error: any) {
    console.error('[API /api/repos POST] Failed to connect repository:', error);
    return NextResponse.json(
      { error: `Failed to connect repository: ${error.message || error}` },
      { status: 500 }
    );
  }
}
