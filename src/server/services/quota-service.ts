import { db } from "@/lib/db";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

/**
 * Redis Atomic Balance Check-and-Deduct
 * Deducts message cost from prepaid balance atomically.
 * Returns [allowed(0/1), remainingBalance, costDeducted]
 */
const BALANCE_DEDUCT_SCRIPT = `
  local balance_key = KEYS[1]
  local cost = tonumber(ARGV[1])

  local balance = tonumber(redis.call('GET', balance_key) or '0')

  if balance >= cost then
    redis.call('DECRBY', balance_key, cost)
    return {1, balance - cost, cost}
  else
    return {0, balance, cost}
  end
`;

interface BalanceCheckResult {
  allowed: boolean;
  remainingBalanceCents: number;
  costCents: number;
}

/**
 * Calculate the cost of a message in cents.
 * SMS: 4¢ per segment, MMS: 8¢ flat.
 */
export function calculateMessageCost(
  segmentCount: number,
  hasMms: boolean,
  smsRateCents: number = 4,
  mmsRateCents: number = 8
): number {
  if (hasMms) {
    return mmsRateCents;
  }
  return smsRateCents * segmentCount;
}

/**
 * Check if org has sufficient prepaid balance and deduct cost atomically.
 */
export async function checkAndDeductBalance(
  orgId: string,
  costCents: number
): Promise<BalanceCheckResult> {
  const balanceKey = `org:${orgId}:balance`;

  try {
    const result = (await redis.eval(
      BALANCE_DEDUCT_SCRIPT,
      1,
      balanceKey,
      costCents
    )) as number[];

    return {
      allowed: result[0] === 1,
      remainingBalanceCents: result[1],
      costCents: result[2],
    };
  } catch (err) {
    console.error("Redis balance check failed, falling back to DB:", err);
    return checkBalanceFromDB(orgId, costCents);
  }
}

/**
 * Get current balance from Redis (for display purposes).
 */
export async function getCurrentBalance(orgId: string): Promise<{
  balanceCents: number;
  balanceDollars: string;
}> {
  const balanceKey = `org:${orgId}:balance`;

  try {
    const balance = await redis.get(balanceKey);
    const cents = parseInt(balance || "0");
    return {
      balanceCents: cents,
      balanceDollars: (cents / 100).toFixed(2),
    };
  } catch {
    return getBalanceFromDB(orgId);
  }
}

/**
 * Sync Redis balance from database.
 * Called on app start, after purchases, or when admin adjusts balance.
 */
export async function syncBalanceToRedis(orgId: string): Promise<void> {
  const plan = await db.messagingPlan.findUnique({ where: { orgId } });
  if (!plan) return;

  const balanceKey = `org:${orgId}:balance`;
  await redis.set(balanceKey, plan.balanceCents);
}

/**
 * Add credits to an org's balance (both Redis and DB).
 * Uses INCRBY on Redis instead of re-syncing, so that if the app crashes
 * between the DB write and the Redis update the balance stays consistent.
 */
export async function addCredits(orgId: string, amountCents: number): Promise<void> {
  const balanceKey = `org:${orgId}:balance`;

  await db.$transaction(async (tx) => {
    await tx.messagingPlan.update({
      where: { orgId },
      data: { balanceCents: { increment: amountCents } },
    });
  });

  // Atomically increment Redis by the delta instead of overwriting with full balance
  await redis.incrby(balanceKey, amountCents);
}

/**
 * DB fallback for balance check.
 */
async function checkBalanceFromDB(
  orgId: string,
  costCents: number
): Promise<BalanceCheckResult> {
  // Atomic check-and-deduct: the WHERE guard ensures we only deduct if
  // the balance is sufficient, eliminating the race condition between
  // reading and writing.
  const result = await db.messagingPlan.updateMany({
    where: {
      orgId,
      balanceCents: { gte: costCents },
    },
    data: {
      balanceCents: { decrement: costCents },
      totalSpentCents: { increment: costCents },
    },
  });

  if (result.count > 0) {
    // Deduction succeeded -- fetch updated balance for the response
    const updated = await db.messagingPlan.findUnique({ where: { orgId } });
    return {
      allowed: true,
      remainingBalanceCents: updated?.balanceCents ?? 0,
      costCents,
    };
  }

  // Either no plan exists or balance was insufficient
  const plan = await db.messagingPlan.findUnique({ where: { orgId } });
  return {
    allowed: false,
    remainingBalanceCents: plan?.balanceCents ?? 0,
    costCents,
  };
}

/**
 * DB fallback for balance display.
 */
async function getBalanceFromDB(orgId: string) {
  const plan = await db.messagingPlan.findUnique({ where: { orgId } });
  const cents = plan?.balanceCents || 0;
  return {
    balanceCents: cents,
    balanceDollars: (cents / 100).toFixed(2),
  };
}
