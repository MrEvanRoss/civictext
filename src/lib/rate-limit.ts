import { redis } from "@/lib/redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Sliding window rate limiter using Redis.
 * Returns whether the request is allowed and how many requests remain.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = now - windowMs;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  try {
    const pipeline = redis.pipeline();
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Add current request
    pipeline.zadd(key, now, member);
    // Count requests in window
    pipeline.zcard(key);
    // Set expiry on the key
    pipeline.expire(key, windowSeconds + 1);

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) || 0;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + windowMs,
    };
  } catch {
    // If Redis is down, allow the request (fail open)
    return { allowed: true, remaining: limit, resetAt: now + windowMs };
  }
}

/**
 * Rate limit by IP address for API routes.
 * Default: 60 requests per minute.
 */
export async function rateLimitByIp(
  ip: string,
  limit = 60,
  windowSeconds = 60
): Promise<RateLimitResult> {
  return rateLimit(`rl:ip:${ip}`, limit, windowSeconds);
}

/**
 * Rate limit by user ID for authenticated actions.
 * Default: 120 requests per minute.
 */
export async function rateLimitByUser(
  userId: string,
  limit = 120,
  windowSeconds = 60
): Promise<RateLimitResult> {
  return rateLimit(`rl:user:${userId}`, limit, windowSeconds);
}

/**
 * Stricter rate limit for auth endpoints (login, register).
 * Default: 10 attempts per 15 minutes.
 */
export async function rateLimitAuth(
  ip: string,
  limit = 10,
  windowSeconds = 900
): Promise<RateLimitResult> {
  return rateLimit(`rl:auth:${ip}`, limit, windowSeconds);
}
