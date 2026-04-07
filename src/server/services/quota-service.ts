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
 */
export async function addCredits(orgId: string, amountCents: number): Promise<void> {
  await db.messagingPlan.update({
    where: { orgId },
    data: { balanceCents: { increment: amountCents } },
  });
  await syncBalanceToRedis(orgId);
}

/**
 * DB fallback for balance check.
 */
async function checkBalanceFromDB(
  orgId: string,
  costCents: number
): Promise<BalanceCheckResult> {
  const plan = await db.messagingPlan.findUnique({ where: { orgId } });
  if (!plan) {
    return { allowed: false, remainingBalanceCents: 0, costCents };
  }

  if (plan.balanceCents >= costCents) {
    await db.messagingPlan.update({
      where: { orgId },
      data: {
        balanceCents: { decrement: costCents },
        totalSpentCents: { increment: costCents },
      },
    });
    return {
      allowed: true,
      remainingBalanceCents: plan.balanceCents - costCents,
      costCents,
    };
  }

  return { allowed: false, remainingBalanceCents: plan.balanceCents, costCents };
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
