import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL || "redis://localhost:6379";

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) return null; // Stop retrying after 10 attempts
      return Math.min(times * 200, 5000);
    },
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("Redis connection error:", err);
  });

  client.on("connect", () => {
    // Connection confirmed — no-op in production; use debug tooling if needed.
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
