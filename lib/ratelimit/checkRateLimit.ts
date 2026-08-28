import { getQueueRedisConnection } from '@/lib/queue/analyzeQueue';

const MAX_ANALYSIS_PER_HOUR = 5;
const WINDOW_SECONDS = 3600; // 1 hour

/**
 * Enforces per-user rate limiting on repository AST analysis / drift check jobs.
 * Uses Redis INCR + EXPIRE counter (fixed-window) to allow a maximum of 5 analysis runs
 * per user per hour.
 *
 * @param userId Unique database CUID or GitHub user ID
 * @param maxRequests Maximum allowed analysis requests per window (default: 5)
 * @param windowSeconds Window length in seconds (default: 3600)
 * @returns Promise<boolean> Returns true if request is allowed, false if limit exceeded.
 */
export async function checkRateLimit(
  userId: string,
  maxRequests: number = MAX_ANALYSIS_PER_HOUR,
  windowSeconds: number = WINDOW_SECONDS
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  try {
    const redis = getQueueRedisConnection();
    const key = `ratelimit:analyze:${userId}`;

    // Atomically increment the request counter
    const current = await redis.incr(key);

    // If this is the first request in the window, set the TTL
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (current > maxRequests) {
      console.warn(
        `⚠️ [RateLimit Exceeded] User ${userId} has triggered ${current} analysis jobs (limit: ${maxRequests}/${windowSeconds}s). Blocking request.`
      );
      return false;
    }

    return true;
  } catch (err: any) {
    // If Redis is temporarily unreachable or errors, log warning and allow request gracefully
    console.warn(`⚠️ [RateLimit Warning] Redis rate limit check failed for user ${userId}:`, err.message || err);
    return true;
  }
}
