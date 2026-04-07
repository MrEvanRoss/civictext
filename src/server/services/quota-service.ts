import { db } from "@/lib/db";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

/**
 * Redis Atomic Quota Check-and-Increment
 * Uses a Lua script for single-roundtrip atomic operation (<1ms).
 */
const QUOTA_CHECK_SCRIPT = `
  local usage_key = KEYS[1]
  local quota_key = KEYS[2]
  local overage_key = KEYS[3]
  local increment = tonumber(ARGV[1])

  local usage = tonumber(redis.call('GET', usage_key) or '0')
  local quota = tonumber(redis.call('GET', quota_key) or '0')
  local overage_permitted = redis.call('GET', overage_key) == '1'

  if usage + increment <= quota then
    redis.call('INCRBY', usage_key, increment)
    return {1, usage + increment, quota, 0}
  elseif overage_permitted then
    redis.call('INCRBY', usage_key, increment)
    return {1, usage + increment, quota, 1}
  else
    return {0, usage, quota, 0}
  end
`;

interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  quota: number;
  isOverage: boolean;
}

/**
 * Check if org has quota remaining and increment usage atomically.
 */
export async function checkAndIncrementQuota(
  orgId: string,
  segmentCount: number = 1
): Promise<QuotaCheckResult> {
  const period = getCurrentBillingPeriod();
  const usageKey = `org:${orgId}:usage:${period}`;
  const quotaKey = `org:${orgId}:quota`;
  const overageKey = `org:${orgId}:overage_permitted`;

  try {
    const result = (await redis.eval(
      QUOTA_CHECK_SCRIPT,
      3,
      usageKey,
      quotaKey,
      overageKey,
      segmentCount
    )) as number[];

    return {
      allowed: result[0] === 1,
      currentUsage: result[1],
      quota: result[2],
      isOverage: result[3] === 1,
    };
  } catch (err) {
    // Fallback to direct DB check if Redis is unavailable
    console.error("Redis quota check failed, falling back to DB:", err);
    return checkQuotaFromDB(orgId, segmentCount);
  }
}

/**
 * Get current usage from Redis (for display purposes).
 */
export async function getCurrentUsage(orgId: string): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  const period = getCurrentBillingPeriod();
  const usageKey = `org:${orgId}:usage:${period}`;
  const quotaKey = `org:${orgId}:quota`;

  try {
    const [usage, quota] = await Promise.all([
      redis.get(usageKey),
      redis.get(quotaKey),
    ]);

    const u = parseInt(usage || "0");
    const q = parseInt(quota || "0");

    return {
      usage: u,
      quota: q,
      percentUsed: q > 0 ? Math.round((u / q) * 100) : 0,
    };
  } catch {
    // Fallback to DB
    return getUsageFromDB(orgId);
  }
}

/**
 * Initialize Redis quota keys from database.
 * Called on app start or when plan changes.
 */
export async function syncQuotaToRedis(orgId: string): Promise<void> {
  const plan = await db.messagingPlan.findUnique({ where: { orgId } });
  if (!plan) return;

  const period = getCurrentBillingPeriod();
  const usageKey = `org:${orgId}:usage:${period}`;
  const quotaKey = `org:${orgId}:quota`;
  const overageKey = `org:${orgId}:overage_permitted`;

  // Get current DB usage
  const dbUsage = await db.usageLedger.aggregate({
    where: {
      orgId,
      createdAt: { gte: getBillingCycleStart(orgId) },
    },
    _sum: { segmentCount: true },
  });

  const totalQuota = plan.monthlyAllotment + (plan.addOnBlockSize || 0);

  await Promise.all([
    redis.set(usageKey, dbUsage._sum.segmentCount || 0),
    redis.set(quotaKey, totalQuota),
    redis.set(overageKey, plan.overagePermitted ? "1" : "0"),
    // TTL: 35 days (slightly more than billing cycle)
    redis.expire(usageKey, 35 * 24 * 60 * 60),
  ]);
}

/**
 * Check which alert thresholds have been crossed.
 */
export function getAlertThreshold(percentUsed: number): number | null {
  const thresholds = [100, 90, 75, 50];
  for (const t of thresholds) {
    if (percentUsed >= t) return t;
  }
  return null;
}

/**
 * DB fallback for quota check.
 */
async function checkQuotaFromDB(
  orgId: string,
  segmentCount: number
): Promise<QuotaCheckResult> {
  const plan = await db.messagingPlan.findUnique({ where: { orgId } });
  if (!plan) {
    return { allowed: false, currentUsage: 0, quota: 0, isOverage: false };
  }

  const usage = await db.usageLedger.aggregate({
    where: {
      orgId,
      createdAt: { gte: getBillingCycleStart(orgId) },
    },
    _sum: { segmentCount: true },
  });

  const currentUsage = usage._sum.segmentCount || 0;
  const quota = plan.monthlyAllotment;

  if (currentUsage + segmentCount <= quota) {
    return { allowed: true, currentUsage: currentUsage + segmentCount, quota, isOverage: false };
  }

  if (plan.overagePermitted) {
    return { allowed: true, currentUsage: currentUsage + segmentCount, quota, isOverage: true };
  }

  return { allowed: false, currentUsage, quota, isOverage: false };
}

/**
 * DB fallback for usage display.
 */
async function getUsageFromDB(orgId: string) {
  const plan = await db.messagingPlan.findUnique({ where: { orgId } });
  const usage = await db.usageLedger.aggregate({
    where: {
      orgId,
      createdAt: { gte: getBillingCycleStart(orgId) },
    },
    _sum: { segmentCount: true },
  });

  const u = usage._sum.segmentCount || 0;
  const q = plan?.monthlyAllotment || 0;

  return {
    usage: u,
    quota: q,
    percentUsed: q > 0 ? Math.round((u / q) * 100) : 0,
  };
}

function getCurrentBillingPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getBillingCycleStart(_orgId: string): Date {
  // Simplified: billing cycle starts on the 1st of the month
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
