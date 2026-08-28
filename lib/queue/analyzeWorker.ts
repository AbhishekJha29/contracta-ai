import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@/lib/db/client';
import { getUserOctokit } from '@/lib/github/userOctokit';
import { fetchAndExtractRepo } from '@/lib/github/fetchRepoSource';
import { cleanupTempDir } from '@/lib/github/cleanupTemp';
import { parseRoutes } from '@/lib/parser/parseRoutes';
import { generateSpec } from '@/lib/generator/generateSpec';
import { diffSpecs } from '@/lib/diff/diffSpecs';
import { RepoAnalysisJobData } from './analyzeQueue';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JOB_TIMEOUT_MS = 60000; // 60 seconds hard timeout per analysis job

/**
 * Returns a dedicated IORedis connection for the BullMQ Worker.
 */
export function getWorkerRedisConnection(): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
  });
}

/**
 * Executes a promise with an enforced timeout limit to prevent worker hangs.
 */
function runWithTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, ms);
  });

  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

/**
 * Core processor for repository AST analysis background jobs.
 */
export async function processAnalysisJob(job: Job<RepoAnalysisJobData>) {
  const { repoId, userId } = job.data;
  console.log(`\n================================================================`);
  console.log(`[Worker Job ${job.id}] Received analysis request for Repo ID: ${repoId}`);
  console.log(`================================================================`);

  // 1. Fetch Repository from Database
  const repo = await prisma.repo.findFirst({
    where: {
      OR: [{ id: repoId }, { githubRepoId: repoId }],
    },
    include: {
      installation: {
        include: {
          user: true,
        },
      },
      baselines: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  if (!repo) {
    throw new Error(`Repository not found in database for ID: ${repoId}`);
  }

  // 2. Retrieve user's GitHub access token
  const repoOwner = repo.installation.user;
  let accessToken: string | null = repoOwner.accessToken;

  if (!accessToken && userId) {
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { githubId: userId }],
      },
    });
    accessToken = dbUser?.accessToken ?? null;
  }

  if (!accessToken) {
    throw new Error(
      `GitHub OAuth access token not found for user (User ID: ${userId}, Repo: ${repo.owner}/${repo.name}). Please re-authenticate.`
    );
  }

  let tempDirToClean: string | undefined;

  const analysisTask = async () => {
    // 3. Authenticate with Octokit
    console.log(`[Worker Job ${job.id}] Initializing Octokit client for ${repo.owner}/${repo.name}...`);
    const octokit = getUserOctokit(accessToken!);

    // 4. Download and extract repository tarball
    console.log(`[Worker Job ${job.id}] Downloading & extracting source archive (branch: ${repo.defaultBranch})...`);
    const { tempDir, extractedPath } = await fetchAndExtractRepo(
      octokit,
      repo.owner,
      repo.name,
      repo.defaultBranch || 'main'
    );
    tempDirToClean = tempDir;

    // 5. Run Phase 1 AST Route Parser
    console.log(`[Worker Job ${job.id}] Running ts-morph AST parser on extracted source code...`);
    const parsedRoutes = parseRoutes(extractedPath);
    console.log(`[Worker Job ${job.id}] Discovered ${parsedRoutes.length} Express route handler(s).`);

    // 6. Run Phase 2 OpenAPI Spec Generator
    console.log(`[Worker Job ${job.id}] Generating OpenAPI 3.0 specification document...`);
    const generatedSpec = generateSpec(parsedRoutes, {
      title: `${repo.owner}/${repo.name} API`,
      version: '1.0.0',
      description: `Contracta living OpenAPI specification extracted from branch "${repo.defaultBranch}".`,
    });

    // 7. Calculate incrementing baseline version & Check for Drift against previous Baseline
    const latestBaseline = repo.baselines[0];
    const nextVersion = (latestBaseline?.version ?? 0) + 1;

    let newDriftReportId: string | undefined;
    let driftSeverity: 'breaking' | 'clean' = 'clean';
    let diffCount = 0;

    if (latestBaseline && latestBaseline.specJson) {
      console.log(`[Worker Job ${job.id}] Running Phase 3 Diff Engine against previous Baseline v${latestBaseline.version}...`);
      try {
        const previousSpec = latestBaseline.specJson as any;
        const diffEntries = diffSpecs(previousSpec, generatedSpec);
        diffCount = diffEntries.length;
        const hasBreaking = diffEntries.some((d) => d.severity === 'breaking');
        driftSeverity = hasBreaking ? 'breaking' : 'clean';

        console.log(
          `[Worker Job ${job.id}] Discovered ${diffEntries.length} schema change(s) (Severity: ${driftSeverity}).`
        );

        const driftReport = await prisma.driftReport.create({
          data: {
            repoId: repo.id,
            baselineVersion: latestBaseline.version,
            diffJson: diffEntries as any,
            severity: driftSeverity,
          },
        });
        newDriftReportId = driftReport.id;
        console.log(
          `✅ [Worker Job ${job.id}] DriftReport created successfully (ID: ${driftReport.id}, Severity: ${driftSeverity})`
        );
      } catch (diffErr: any) {
        console.error(`⚠️ [Worker Job ${job.id}] Warning: Diff calculation encountered an error:`, diffErr);
      }
    } else {
      console.log(
        `[Worker Job ${job.id}] Initial Baseline run for ${repo.owner}/${repo.name}. Skipping drift report (no previous baseline).`
      );
    }

    // 8. Persist new Baseline in Prisma
    console.log(`[Worker Job ${job.id}] Saving Baseline v${nextVersion} to database...`);
    const newBaseline = await prisma.baseline.create({
      data: {
        repoId: repo.id,
        version: nextVersion,
        specJson: generatedSpec as any,
      },
    });

    console.log(`✅ [Worker Job ${job.id}] Baseline v${nextVersion} created successfully (ID: ${newBaseline.id})`);
    console.log(`================================================================\n`);

    return {
      baselineId: newBaseline.id,
      version: newBaseline.version,
      routesCount: parsedRoutes.length,
      driftReportId: newDriftReportId,
      driftSeverity,
      diffCount,
    };
  };

  try {
    return await runWithTimeout(
      analysisTask(),
      JOB_TIMEOUT_MS,
      `Analysis timed out after ${JOB_TIMEOUT_MS / 1000}s for ${repo.owner}/${repo.name}`
    );
  } finally {
    // 9. Guarantee temp directory cleanup in finally block regardless of success or failure/timeout
    if (tempDirToClean) {
      console.log(`[Worker Job ${job.id}] Cleaning up temporary directory: ${tempDirToClean}`);
      cleanupTempDir(tempDirToClean);
    }
  }
}

/**
 * Creates and starts a BullMQ Worker instance consuming the "repo-analysis" queue.
 */
export function startWorker(): Worker<RepoAnalysisJobData> {
  const worker = new Worker<RepoAnalysisJobData>(
    'repo-analysis',
    async (job) => {
      return await processAnalysisJob(job);
    },
    {
      connection: getWorkerRedisConnection(),
      concurrency: 3, // Process up to 3 repositories in parallel
    }
  );

  worker.on('ready', () => {
    console.log('⚡ [Worker Ready] Connected to Redis and listening for "repo-analysis" jobs.');
  });

  worker.on('active', (job) => {
    console.log(`🔄 [Worker Active] Processing job ${job.id} (Repo ID: ${job.data.repoId})`);
  });

  worker.on('completed', (job, result) => {
    console.log(`✅ [Worker Completed] Job ${job.id} finished successfully. Baseline v${result?.version} saved.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [Worker Failed] Job ${job?.id} failed for Repo ID ${job?.data?.repoId}:`, err.message || err);
  });

  worker.on('error', (err) => {
    console.error('⚠️ [Worker Error] Unexpected error in BullMQ worker connection:', err);
  });

  return worker;
}
