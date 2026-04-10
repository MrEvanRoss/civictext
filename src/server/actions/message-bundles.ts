"use server";

import { requireOrg, requirePermission } from "./auth";
import { db } from "@/lib/db";
import { PERMISSIONS, DEFAULT_SMS_RATE_CENTS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Bundle tier definitions
// ---------------------------------------------------------------------------

// Standard rate in dollars — baseline for bundle savings percentage display
const STANDARD_RATE = DEFAULT_SMS_RATE_CENTS / 100;

export const BUNDLE_TIERS = {
  starter: {
    name: "Starter",
    messageCount: 5_000,
    pricePerMessage: 0.03,
    totalPrice: 150,
  },
  growth: {
    name: "Growth",
    messageCount: 25_000,
    pricePerMessage: 0.025,
    totalPrice: 625,
  },
  scale: {
    name: "Scale",
    messageCount: 100_000,
    pricePerMessage: 0.02,
    totalPrice: 2_000,
  },
  enterprise: {
    name: "Enterprise",
    messageCount: 500_000,
    pricePerMessage: 0.015,
    totalPrice: 7_500,
  },
} as const;

export type BundleTier = keyof typeof BUNDLE_TIERS;

// ---------------------------------------------------------------------------
// listBundlesAction — all bundles for the org, newest first
// ---------------------------------------------------------------------------

export async function listBundlesAction() {
  await requirePermission(PERMISSIONS.BILLING_VIEW);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const bundles = await db.messageBundle.findMany({
    where: { orgId },
    orderBy: { purchasedAt: "desc" },
  });

  return bundles;
}

// ---------------------------------------------------------------------------
// getActiveBundlesAction — bundles with remaining > 0 and not expired
// ---------------------------------------------------------------------------

export async function getActiveBundlesAction() {
  await requirePermission(PERMISSIONS.BILLING_VIEW);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const now = new Date();

  const bundles = await db.messageBundle.findMany({
    where: {
      orgId,
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { purchasedAt: "asc" },
  });

  return bundles;
}

// ---------------------------------------------------------------------------
// purchaseBundleAction — create a bundle purchase record
// (Stripe integration placeholder — currently creates the record directly)
// ---------------------------------------------------------------------------

export async function purchaseBundleAction(tier: BundleTier) {
  await requirePermission(PERMISSIONS.BILLING_MANAGE);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const tierDef = BUNDLE_TIERS[tier];
  if (!tierDef) {
    throw new Error(`Unknown bundle tier: ${tier}`);
  }

  // Set expiry to 12 months from now
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const bundle = await db.messageBundle.create({
    data: {
      orgId,
      bundleName: tierDef.name,
      messageCount: tierDef.messageCount,
      pricePerMessage: tierDef.pricePerMessage,
      totalPrice: tierDef.totalPrice,
      remaining: tierDef.messageCount,
      expiresAt,
      // stripePaymentId will be set when Stripe is integrated
    },
  });

  return bundle;
}

// ---------------------------------------------------------------------------
// deductFromBundleAction — FIFO deduction from oldest non-expired bundle
// ---------------------------------------------------------------------------

export async function deductFromBundleAction(
  orgId: string,
  count: number
): Promise<{ deducted: number; fromBundle: string } | null> {
  const now = new Date();

  // Get oldest non-expired bundle with remaining messages
  const bundle = await db.messageBundle.findFirst({
    where: {
      orgId,
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { purchasedAt: "asc" },
  });

  if (!bundle) {
    return null;
  }

  const deducted = Math.min(count, bundle.remaining);

  await db.messageBundle.update({
    where: { id: bundle.id },
    data: { remaining: bundle.remaining - deducted },
  });

  return { deducted, fromBundle: bundle.id };
}

// ---------------------------------------------------------------------------
// getBundleSummaryAction — aggregate stats across active bundles
// ---------------------------------------------------------------------------

export async function getBundleSummaryAction() {
  await requirePermission(PERMISSIONS.BILLING_VIEW);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const now = new Date();

  const [activeBundles, allBundles] = await Promise.all([
    db.messageBundle.findMany({
      where: {
        orgId,
        remaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    db.messageBundle.findMany({
      where: { orgId },
    }),
  ]);

  const totalRemaining = activeBundles.reduce((sum, b) => sum + b.remaining, 0);
  const totalSpent = allBundles.reduce((sum, b) => sum + b.totalPrice, 0);
  const totalMessagesPurchased = allBundles.reduce(
    (sum, b) => sum + b.messageCount,
    0
  );

  // Savings = what they would have paid at standard rate minus what they paid
  const standardCost = totalMessagesPurchased * STANDARD_RATE;
  const savings = standardCost - totalSpent;

  return {
    totalRemaining,
    totalSpent,
    totalMessagesPurchased,
    savings: Math.max(0, savings),
    activeBundleCount: activeBundles.length,
  };
}
