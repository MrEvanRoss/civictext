"use server";

import { requireSuperAdmin } from "./auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { syncBalanceToRedis, addCredits } from "@/server/services/quota-service";
import bcrypt from "bcryptjs";

// ============================================================
// ORG MANAGEMENT
// ============================================================

export async function listOrgsAction(opts?: {
  search?: string;
  status?: string;
  page?: number;
}) {
  await requireSuperAdmin();
  const page = opts?.page || 1;
  const pageSize = 20;

  const where: any = {};
  if (opts?.search) {
    where.OR = [
      { name: { contains: opts.search, mode: "insensitive" } },
      { slug: { contains: opts.search, mode: "insensitive" } },
    ];
  }
  if (opts?.status) {
    where.status = opts.status;
  }

  const [orgs, total] = await Promise.all([
    db.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { users: true, contacts: true, campaigns: true } },
        messagingPlan: { select: { balanceCents: true } },
      },
    }),
    db.organization.count({ where }),
  ]);

  return { orgs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getOrgDetailAction(orgId: string) {
  await requireSuperAdmin();

  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, lastLoginAt: true } },
      messagingPlan: true,
      twilioSubaccount: { select: { accountSid: true, messagingServiceSid: true } },
      brandRegistrations: { orderBy: { createdAt: "desc" }, take: 1 },
      campaignRegistrations: { orderBy: { createdAt: "desc" }, take: 1 },
      phoneNumbers: { where: { status: "ACTIVE" } },
      _count: { select: { contacts: true, campaigns: true, messages: true } },
    },
  });

  if (!org) throw new Error("Organization not found");

  // Get recent usage
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [messageCount, deliveredCount, optOutCount] = await Promise.all([
    db.message.count({
      where: { orgId, direction: "OUTBOUND", createdAt: { gte: thirtyDaysAgo } },
    }),
    db.message.count({
      where: { orgId, direction: "OUTBOUND", status: "DELIVERED", createdAt: { gte: thirtyDaysAgo } },
    }),
    db.contact.count({
      where: { orgId, optInStatus: "OPTED_OUT", optOutTimestamp: { gte: thirtyDaysAgo } },
    }),
  ]);

  return {
    ...org,
    stats: {
      messageCount,
      deliveredCount,
      deliveryRate: messageCount > 0 ? ((deliveredCount / messageCount) * 100).toFixed(1) : "0",
      optOutCount,
    },
  };
}

export async function suspendOrgAction(orgId: string, reason: string) {
  await requireSuperAdmin();

  await db.organization.update({
    where: { id: orgId },
    data: { status: "SUSPENDED" },
  });

  console.log(`[ADMIN] Org ${orgId} suspended. Reason: ${reason}`);
  return { success: true };
}

export async function approveOrgAction(orgId: string) {
  await requireSuperAdmin();

  await db.organization.update({
    where: { id: orgId },
    data: { status: "ACTIVE" },
  });

  console.log(`[ADMIN] Org ${orgId} approved`);
  return { success: true };
}

export async function reactivateOrgAction(orgId: string) {
  await requireSuperAdmin();

  await db.organization.update({
    where: { id: orgId },
    data: { status: "ACTIVE" },
  });

  console.log(`[ADMIN] Org ${orgId} reactivated`);
  return { success: true };
}

/**
 * Add prepaid credits to an org's balance.
 */
export async function addCreditsAction(orgId: string, amountCents: number) {
  await requireSuperAdmin();

  await addCredits(orgId, amountCents);

  console.log(`[ADMIN] Added ${amountCents}¢ credits to org ${orgId}`);
  return { success: true };
}

/**
 * Update an org's per-message rates.
 */
export async function updateOrgRatesAction(
  orgId: string,
  updates: { smsRateCents?: number; mmsRateCents?: number }
) {
  await requireSuperAdmin();

  await db.messagingPlan.update({
    where: { orgId },
    data: updates,
  });

  return { success: true };
}

export async function createOrgAction(data: {
  orgName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  initialCreditsDollars?: number;
}) {
  await requireSuperAdmin();

  const existing = await db.user.findUnique({
    where: { email: data.ownerEmail },
  });
  if (existing) {
    throw new Error("A user with that email already exists");
  }

  const passwordHash = await bcrypt.hash(data.ownerPassword, 12);
  const slug = data.orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const initialCreditsCents = Math.round((data.initialCreditsDollars || 0) * 100);

  const result = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: data.orgName,
        slug,
      },
    });

    const user = await tx.user.create({
      data: {
        email: data.ownerEmail,
        passwordHash,
        name: data.ownerName,
        orgId: org.id,
        role: "OWNER",
      },
    });

    await tx.messagingPlan.create({
      data: {
        orgId: org.id,
        balanceCents: initialCreditsCents,
        smsRateCents: 4,
        mmsRateCents: 8,
      },
    });

    return { org, user };
  });

  // Sync balance to Redis
  await syncBalanceToRedis(result.org.id);

  return { success: true, orgId: result.org.id, userId: result.user.id };
}

// ============================================================
// GLOBAL ANALYTICS
// ============================================================

export async function getGlobalAnalyticsAction() {
  await requireSuperAdmin();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalOrgs,
    activeOrgs,
    suspendedOrgs,
    totalUsers,
    totalContacts,
    totalMessages,
    deliveredMessages,
    failedMessages,
    totalCampaigns,
  ] = await Promise.all([
    db.organization.count(),
    db.organization.count({ where: { status: "ACTIVE" } }),
    db.organization.count({ where: { status: "SUSPENDED" } }),
    db.user.count(),
    db.contact.count(),
    db.message.count({ where: { direction: "OUTBOUND", createdAt: { gte: thirtyDaysAgo } } }),
    db.message.count({ where: { direction: "OUTBOUND", status: "DELIVERED", createdAt: { gte: thirtyDaysAgo } } }),
    db.message.count({
      where: { direction: "OUTBOUND", status: { in: ["FAILED", "UNDELIVERED"] }, createdAt: { gte: thirtyDaysAgo } },
    }),
    db.campaign.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  const deliveryRate =
    totalMessages > 0 ? ((deliveredMessages / totalMessages) * 100).toFixed(1) : "0";

  // Top orgs by volume
  const topOrgs = await db.message.groupBy({
    by: ["orgId"],
    where: { direction: "OUTBOUND", createdAt: { gte: thirtyDaysAgo } },
    _count: true,
    orderBy: { _count: { orgId: "desc" } },
    take: 10,
  });

  const topOrgDetails = await Promise.all(
    topOrgs.map(async (o) => {
      const org = await db.organization.findUnique({
        where: { id: o.orgId },
        select: { name: true, status: true },
      });
      return { orgId: o.orgId, name: org?.name || "Unknown", status: org?.status, messageCount: o._count };
    })
  );

  return {
    totalOrgs,
    activeOrgs,
    suspendedOrgs,
    totalUsers,
    totalContacts,
    totalMessages,
    deliveredMessages,
    failedMessages,
    deliveryRate,
    totalCampaigns,
    topOrgs: topOrgDetails,
  };
}

// ============================================================
// COMPLIANCE MONITORING
// ============================================================

export async function getComplianceOverviewAction() {
  await requireSuperAdmin();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const campaigns = await db.campaign.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: thirtyDaysAgo },
      sentCount: { gt: 100 },
    },
    select: {
      id: true,
      name: true,
      orgId: true,
      sentCount: true,
      optOutCount: true,
      deliveredCount: true,
      failedCount: true,
    },
    orderBy: { optOutCount: "desc" },
    take: 20,
  });

  const highOptOutCampaigns = campaigns
    .filter((c) => c.sentCount > 0 && (c.optOutCount / c.sentCount) * 100 > 5)
    .map((c) => ({
      ...c,
      optOutRate: ((c.optOutCount / c.sentCount) * 100).toFixed(1),
    }));

  const highFailureOrgs = campaigns
    .filter((c) => c.sentCount > 0 && (c.failedCount / c.sentCount) * 100 > 10)
    .map((c) => ({
      ...c,
      failureRate: ((c.failedCount / c.sentCount) * 100).toFixed(1),
    }));

  const [pendingBrands, approvedBrands, rejectedBrands, pendingCampaigns, approvedCampaigns] =
    await Promise.all([
      db.brandRegistration.count({ where: { status: "PENDING" } }),
      db.brandRegistration.count({ where: { status: "APPROVED" } }),
      db.brandRegistration.count({ where: { status: "REJECTED" } }),
      db.campaignRegistration.count({ where: { status: "PENDING" } }),
      db.campaignRegistration.count({ where: { status: "APPROVED" } }),
    ]);

  const orgIds = Array.from(new Set([...highOptOutCampaigns, ...highFailureOrgs].map((c) => c.orgId)));
  const orgs = await db.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

  return {
    highOptOutCampaigns: highOptOutCampaigns.map((c) => ({ ...c, orgName: orgMap[c.orgId] || "Unknown" })),
    highFailureOrgs: highFailureOrgs.map((c) => ({ ...c, orgName: orgMap[c.orgId] || "Unknown" })),
    dlcStatus: {
      pendingBrands,
      approvedBrands,
      rejectedBrands,
      pendingCampaigns,
      approvedCampaigns,
    },
  };
}

// ============================================================
// SYSTEM HEALTH
// ============================================================

export async function getSystemHealthAction() {
  await requireSuperAdmin();

  let redisStatus = "unknown";
  let redisMemory = "unknown";
  try {
    const info = await redis.info("memory");
    const usedMemMatch = info.match(/used_memory_human:(\S+)/);
    redisMemory = usedMemMatch?.[1] || "unknown";
    redisStatus = "connected";
  } catch {
    redisStatus = "disconnected";
  }

  let dbStatus = "unknown";
  let dbOrgCount = 0;
  try {
    dbOrgCount = await db.organization.count();
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  let queueDepth = 0;
  let failedJobs = 0;
  try {
    const keys = await redis.keys("bull:messages:*");
    queueDepth = keys.length;
    const failedKeys = await redis.keys("bull:messages:failed*");
    failedJobs = failedKeys.length;
  } catch {
    // Redis not available
  }

  return {
    redis: { status: redisStatus, memory: redisMemory },
    database: { status: dbStatus, orgCount: dbOrgCount },
    queues: { depth: queueDepth, failedJobs },
    uptime: process.uptime(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || "development",
  };
}
