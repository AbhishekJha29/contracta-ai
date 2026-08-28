import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export interface RepoAnalysisJobData {
  repoId: string;
  userId: string;
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Global singleton to prevent connection leaks during Next.js development hot-reloads
const globalForQueue = globalThis as unknown as {
  analysisQueue?: Queue<RepoAnalysisJobData>;
  queueRedisConnection?: IORedis;
};

/**
 * Returns a shared IORedis instance configured specifically for BullMQ compatibility.
 */
export function getQueueRedisConnection(): IORedis {
  if (!globalForQueue.queueRedisConnection) {
    globalForQueue.queueRedisConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
    });
  }
  return globalForQueue.queueRedisConnection;
}

export const analyzeQueue =
  globalForQueue.analysisQueue ??
  new Queue<RepoAnalysisJobData>('repo-analysis', {
    connection: getQueueRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.analysisQueue = analyzeQueue;
}

/**
 * Enqueues a repository analysis job into the BullMQ "repo-analysis" queue.
 *
 * @param repoId Database CUID or GitHub repository ID
 * @param userId Authenticated user ID requesting the analysis
 * @returns Generated BullMQ Job ID
 */
export async function enqueueAnalysis(repoId: string, userId: string): Promise<string> {
  const job = await analyzeQueue.add(
    'analyze-repo',
    { repoId, userId },
    {
      jobId: `analyze-${repoId}-${Date.now()}`,
    }
  );

  return job.id ?? `job-${Date.now()}`;
}
