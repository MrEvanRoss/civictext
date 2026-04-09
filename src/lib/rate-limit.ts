import { redis } from "@/lib/redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * In-memory fallback rate limiter for when Redis is unavailable.
 * Uses a conservative limit to prevent abuse during outages.
 * Entries are cleaned up lazily on each call.
 */
const memoryFallback = new Map<string, { count: number; windowStart: number }>();
const FALLBACK_LIMIT = 3; // Conservative: 3 requests per window when Redis is down
const FALLBACK_CLEANUP_INTERVAL = 60_000; // Clean stale entries every 60s
let lastCleanup = Date.now();

function memoryRateLimit(
  key: string,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // Periodic cleanup of stale entries to prevent memory leaks
  if (now - lastCleanup > FALLBACK_CLEANUP_INTERVAL) {
    memoryFallback.forEach((v, k) => {
      if (now - v.windowStart > windowMs * 2) memoryFallback.delete(k);
    });
    lastCleanup = now;
  }

  const entry = memoryFallback.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    memoryFallback.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: FALLBACK_LIMIT - 1,
      resetAt: now + windowMs,
    };
  }

  entry.count++;
  const allowed = entry.count <= FALLBACK_LIMIT;
  return {
    allowed,
    remaining: Math.max(0, FALLBACK_LIMIT - entry.count),
    resetAt: entry.windowStart + windowMs,
  };
}

/**
 * Sliding window rate limiter using Redis.
 * Falls back to a conservative in-memory limiter when Redis is unavailable
 * (fail-closed pattern — never allows unlimited requests).
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
    // Redis unavailable — use conservative in-memory fallback (fail closed)
    console.warn(`[rate-limit] Redis unavailable for key ${key}, using in-memory fallback`);
    return memoryRateLimit(key, windowSeconds);
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

/**
 * Rate limit for inbound Twilio webhooks by phone number.
 * Prevents abuse from a single phone number flooding the system.
 * Default: 60 requests per minute per phone number.
 */
export async function rateLimitInboundWebhook(
  phoneNumber: string,
  limit = 60,
  windowSeconds = 60
): Promise<RateLimitResult> {
  return rateLimit(`rl:webhook:inbound:${phoneNumber}`, limit, windowSeconds);
}
