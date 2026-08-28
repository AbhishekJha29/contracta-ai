import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/client';
import { enqueueAnalysis } from '@/lib/queue/analyzeQueue';
import { checkRateLimit } from '@/lib/ratelimit/checkRateLimit';

/**
 * Validates the GitHub webhook payload using HMAC SHA-256 signature.
 *
 * NOTE: Next.js App Router requires reading the raw request body string via request.text(),
 * NOT the parsed JSON object, before computing the HMAC digest.
 */
function verifyGitHubSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = parts[1];
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  if (expectedSignature.length !== computedSignature.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/github - Handles incoming GitHub webhook push events
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ [Webhook Error] GITHUB_WEBHOOK_SECRET is not defined in environment.');
    return NextResponse.json(
      { error: 'Webhook secret is not configured on server.' },
      { status: 500 }
    );
  }

  // 1. Read raw request body for HMAC verification
  // NOTE: Next.js App Router requires reading the raw text body, not parsed JSON, before verifying.
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  // 2. Verify signature
  const isValid = verifyGitHubSignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    console.warn('⚠️ [Webhook Warning] Invalid or missing X-Hub-Signature-256. Rejecting request.');
    return NextResponse.json(
      { error: 'Invalid webhook signature.' },
      { status: 401 }
    );
  }

  // 3. Check event type
  const event = request.headers.get('x-github-event');
  const deliveryId = request.headers.get('x-github-delivery');
  console.log(`[GitHub Webhook] Received event "${event}" (Delivery: ${deliveryId})`);

  // Handle GitHub's initial ping event upon webhook creation
  if (event === 'ping') {
    console.log('✅ [GitHub Webhook] Received ping event. Webhook verification handshake successful.');
    return NextResponse.json({ message: 'Ping acknowledged.' }, { status: 200 });
  }

  // Only handle push events; return 200 for other events to prevent GitHub retries
  if (event !== 'push') {
    console.log(`ℹ️ [GitHub Webhook] Ignoring non-push event: "${event}". Returning 200.`);
    return NextResponse.json({ message: `Event "${event}" ignored.` }, { status: 200 });
  }

  // 4. Parse payload and extract repository and ref metadata
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err: any) {
    console.error('❌ [GitHub Webhook] Malformed JSON payload:', err.message);
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }

  const repoFullName: string | undefined = payload.repository?.full_name;
  const githubRepoId = payload.repository?.id ? String(payload.repository.id) : undefined;
  const ref: string | undefined = payload.ref; // e.g. "refs/heads/main"

  if (!repoFullName || !ref) {
    console.warn('⚠️ [GitHub Webhook] Missing repository.full_name or ref in push payload.');
    return NextResponse.json({ message: 'Missing required payload fields.' }, { status: 200 });
  }

  const [owner, name] = repoFullName.split('/');
  const pushedBranch = ref.replace(/^refs\/heads\//, '');

  console.log(`[GitHub Webhook] Push detected for ${owner}/${name} on branch "${pushedBranch}"`);

  // 5. Look up matching Repo(s) in database by owner+name or githubRepoId
  const repos = await prisma.repo.findMany({
    where: {
      OR: [
        ...(githubRepoId ? [{ githubRepoId }] : []),
        { owner, name },
      ],
    },
    include: {
      installation: true,
    },
  });

  if (!repos || repos.length === 0) {
    console.log(`ℹ️ [GitHub Webhook] Repository ${repoFullName} is not monitored in Contracta. Ignoring.`);
    return NextResponse.json(
      { message: `Repository ${repoFullName} is not connected in Contracta.` },
      { status: 200 }
    );
  }

  // 6. Branch filtering: Only trigger analysis for repos where pushed branch matches defaultBranch
  const matchingRepos = repos.filter(
    (repo) => pushedBranch === (repo.defaultBranch || 'main')
  );

  if (matchingRepos.length === 0) {
    console.log(
      `ℹ️ [GitHub Webhook] Pushed branch "${pushedBranch}" does not match default branch for ${repoFullName}. Ignoring.`
    );
    return NextResponse.json(
      {
        message: `Branch "${pushedBranch}" is not the monitored default branch for repository.`,
      },
      { status: 200 }
    );
  }

  // 7. Enqueue background analysis + drift detection job (with rate limit protection)
  try {
    const jobIds: string[] = [];
    for (const repo of matchingRepos) {
      const userId = repo.installation.userId;

      // Enforce rate limit (max 5 analysis jobs per user per hour)
      const isAllowed = await checkRateLimit(userId);
      if (!isAllowed) {
        console.warn(
          `⚠️ [GitHub Webhook RateLimit] Rate limit exceeded for user ${userId} on ${repo.owner}/${repo.name}. Skipping auto-analysis job.`
        );
        continue;
      }

      const jobId = await enqueueAnalysis(repo.id, userId);
      jobIds.push(jobId);
      console.log(
        `⚡ [GitHub Webhook] Successfully enqueued background analysis job ${jobId} for ${repo.owner}/${repo.name} (branch: ${pushedBranch})`
      );
    }

    if (jobIds.length === 0 && matchingRepos.length > 0) {
      return NextResponse.json(
        {
          received: true,
          queued: false,
          error: 'Rate limit exceeded for repository owner. Analysis run skipped.',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        received: true,
        queued: true,
        jobIds,
        repo: repoFullName,
        branch: pushedBranch,
      },
      { status: 200 }
    );
  } catch (queueErr: any) {
    console.error('❌ [GitHub Webhook] Failed to enqueue analysis job:', queueErr);
    return NextResponse.json(
      { error: `Failed to enqueue background analysis: ${queueErr.message || queueErr}` },
      { status: 500 }
    );
  }
}
