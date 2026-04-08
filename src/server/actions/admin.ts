"use server";

import { requireSuperAdmin } from "./auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { syncBalanceToRedis, addCredits } from "@/server/services/quota-service";
import { MIN_TRANSACTION_CENTS } from "@/lib/constants";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createOrgSchema = z.object({
  orgName: z.string().min(1, "Organization name is required").max(200),
  ownerName: z.string().min(1, "Owner name is required").max(200),
  ownerEmail: z.string().email("Invalid email address"),
  ownerPassword: z.string().min(12, "Password must be at least 12 characters"),
  initialCreditsDollars: z.number().min(0).optional(),
});

const updateRatesSchema = z.object({
  smsRateCents: z.number().int().min(0).max(100).optional(),
  mmsRateCents: z.number().int().min(0).max(200).optional(),
  phoneNumberFeeCents: z.number().int().min(0).max(10000).optional(),
});

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
      users: { select: { id: true, name: true, email: true, role: true, lastLoginAt: true, twoFactorEnabled: true } },
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

  console.info(`[ADMIN] Org ${orgId} suspended. Reason: ${reason}`);
  return { success: true };
}

export async function approveOrgAction(orgId: string) {
  await requireSuperAdmin();

  await db.organization.update({
    where: { id: orgId },
    data: { status: "ACTIVE" },
  });

  console.info(`[ADMIN] Org ${orgId} approved`);
  return { success: true };
}

export async function reactivateOrgAction(orgId: string) {
  await requireSuperAdmin();

  await db.organization.update({
    where: { id: orgId },
    data: { status: "ACTIVE" },
  });

  console.info(`[ADMIN] Org ${orgId} reactivated`);
  return { success: true };
}

/**
 * Add prepaid credits to an org's balance.
 */
export async function addCreditsAction(orgId: string, amountCents: number) {
  await requireSuperAdmin();

  z.string().uuid().parse(orgId);
  z.number().int().positive().parse(amountCents);

  if (amountCents < MIN_TRANSACTION_CENTS) {
    throw new Error(`Minimum transaction is $${(MIN_TRANSACTION_CENTS / 100).toFixed(2)}`);
  }

  await addCredits(orgId, amountCents);

  console.info(`[ADMIN] Added ${amountCents}¢ credits to org ${orgId}`);
  return { success: true };
}

/**
 * Update an org's per-message rates and phone number fee.
 */
export async function updateOrgRatesAction(
  orgId: string,
  updates: { smsRateCents?: number; mmsRateCents?: number; phoneNumberFeeCents?: number }
) {
  await requireSuperAdmin();

  z.string().uuid().parse(orgId);
  const validated = updateRatesSchema.parse(updates);

  await db.messagingPlan.update({
    where: { orgId },
    data: validated,
  });

  return { success: true };
}

/**
 * Update which campaign types an org is allowed to use.
 */
export async function updateAllowedCampaignTypesAction(
  orgId: string,
  allowedTypes: string[]
) {
  await requireSuperAdmin();

  const validTypes = ["BROADCAST", "P2P", "GOTV", "DRIP", "AUTO_REPLY"];
  const filtered = allowedTypes.filter((t) => validTypes.includes(t));

  if (filtered.length === 0) {
    throw new Error("At least one campaign type must be allowed");
  }

  await db.organization.update({
    where: { id: orgId },
    data: { allowedCampaignTypes: filtered },
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

  const validated = createOrgSchema.parse(data);

  const existing = await db.user.findUnique({
    where: { email: validated.ownerEmail },
  });
  if (existing) {
    throw new Error("A user with that email already exists");
  }

  const passwordHash = await bcrypt.hash(validated.ownerPassword, 12);
  const slug = validated.orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const initialCreditsCents = Math.round((validated.initialCreditsDollars || 0) * 100);
  if (initialCreditsCents > 0 && initialCreditsCents < MIN_TRANSACTION_CENTS) {
    throw new Error(`Minimum initial credits is $${(MIN_TRANSACTION_CENTS / 100).toFixed(2)}`);
  }

  const result = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: validated.orgName,
        slug,
      },
    });

    const user = await tx.user.create({
      data: {
        email: validated.ownerEmail,
        passwordHash,
        name: validated.ownerName,
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

// ============================================================
// ORG DEEP DRILL-DOWN (Campaigns, Contacts, Interest Lists, etc.)
// ============================================================

export async function getOrgCampaignsAction(orgId: string) {
  await requireSuperAdmin();

  return db.campaign.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      messageBody: true,
      totalRecipients: true,
      sentCount: true,
      deliveredCount: true,
      failedCount: true,
      responseCount: true,
      optOutCount: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
}

export async function getOrgContactsAction(orgId: string, opts?: { page?: number; search?: string }) {
  await requireSuperAdmin();
  const page = opts?.page || 1;
  const pageSize = 50;

  const where: any = { orgId };
  if (opts?.search) {
    where.OR = [
      { phone: { contains: opts.search } },
      { firstName: { contains: opts.search, mode: "insensitive" } },
      { lastName: { contains: opts.search, mode: "insensitive" } },
      { email: { contains: opts.search, mode: "insensitive" } },
    ];
  }

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        email: true,
        tags: true,
        optInStatus: true,
        lastMessageAt: true,
        createdAt: true,
      },
    }),
    db.contact.count({ where }),
  ]);

  return { contacts, total, page, totalPages: Math.ceil(total / pageSize) };
}

export async function getOrgInterestListsAction(orgId: string) {
  await requireSuperAdmin();

  return db.interestList.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyword: true,
      description: true,
      memberCount: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function getOrgTemplatesAction(orgId: string) {
  await requireSuperAdmin();

  return db.messageTemplate.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      category: true,
      body: true,
      usageCount: true,
      createdAt: true,
    },
  });
}

export async function getOrgWebhooksAction(orgId: string) {
  await requireSuperAdmin();

  return db.webhookEndpoint.findMany({
    where: { orgId },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      failCount: true,
      lastError: true,
      createdAt: true,
    },
  });
}

export async function getOrgAutoReplyRulesAction(orgId: string) {
  await requireSuperAdmin();

  return db.autoReplyRule.findMany({
    where: { orgId },
    orderBy: { priority: "desc" },
    select: {
      id: true,
      name: true,
      keywords: true,
      replyBody: true,
      isActive: true,
      priority: true,
    },
  });
}

export async function getOrgConsentLogsAction(orgId: string, opts?: { page?: number }) {
  await requireSuperAdmin();
  const page = opts?.page || 1;
  const pageSize = 50;

  const [logs, total] = await Promise.all([
    db.consentAuditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contact: { select: { phone: true, firstName: true, lastName: true } },
      },
    }),
    db.consentAuditLog.count({ where: { orgId } }),
  ]);

  return { logs, total, page, totalPages: Math.ceil(total / pageSize) };
}

// ============================================================
// IMPERSONATION (switch to a client's org)
// ============================================================

/**
 * Start impersonation: returns a temporary JWT-like payload
 * The frontend stores the original admin identity and overrides orgId.
 */
export async function startImpersonationAction(orgId: string) {
  const session = await requireSuperAdmin();
  const adminUserId = (session.user as any).id;

  // Verify the org exists
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });
  if (!org) throw new Error("Organization not found");

  // Find the org owner to impersonate (or first admin/user)
  const targetUser = await db.user.findFirst({
    where: { orgId },
    orderBy: [
      { role: "asc" }, // OWNER first in enum
    ],
    select: { id: true, name: true, email: true, role: true, orgId: true },
  });

  if (!targetUser) throw new Error("No users found in this organization");

  return {
    targetUserId: targetUser.id,
    targetUserName: targetUser.name,
    targetUserEmail: targetUser.email,
    targetOrgId: org.id,
    targetOrgName: org.name,
    adminUserId,
  };
}

/**
 * Reset (disable) 2FA for a user. Super admin override for locked-out users.
 */
export async function resetUser2FAAction(userId: string) {
  await requireSuperAdmin();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, twoFactorEnabled: true },
  });
  if (!user) throw new Error("User not found");
  if (!user.twoFactorEnabled) throw new Error("2FA is not enabled for this user");

  await db.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });

  return { reset: true, userName: user.name, userEmail: user.email };
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

// ============================================================
// MESSAGE LOG
// ============================================================

export async function listMessagesAction(opts?: {
  orgId?: string;
  direction?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
}) {
  await requireSuperAdmin();
  const page = opts?.page || 1;
  const pageSize = 50;

  const where: any = {};
  if (opts?.orgId) where.orgId = opts.orgId;
  if (opts?.direction) where.direction = opts.direction;
  if (opts?.status) where.status = opts.status;
  if (opts?.search) {
    where.OR = [
      { body: { contains: opts.search, mode: "insensitive" } },
      { contact: { phone: { contains: opts.search } } },
      { twilioSid: { contains: opts.search } },
    ];
  }
  if (opts?.startDate || opts?.endDate) {
    where.createdAt = {};
    if (opts?.startDate) where.createdAt.gte = new Date(opts.startDate);
    if (opts?.endDate) {
      const end = new Date(opts.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [messages, total] = await Promise.all([
    db.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        org: { select: { name: true } },
        contact: { select: { phone: true, firstName: true, lastName: true } },
        campaign: { select: { name: true } },
      },
    }),
    db.message.count({ where }),
  ]);

  return {
    messages,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function exportMessagesAction(opts?: {
  orgId?: string;
  direction?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}) {
  await requireSuperAdmin();

  const where: any = {};
  if (opts?.orgId) where.orgId = opts.orgId;
  if (opts?.direction) where.direction = opts.direction;
  if (opts?.status) where.status = opts.status;
  if (opts?.search) {
    where.OR = [
      { body: { contains: opts.search, mode: "insensitive" } },
      { contact: { phone: { contains: opts.search } } },
    ];
  }
  if (opts?.startDate || opts?.endDate) {
    where.createdAt = {};
    if (opts?.startDate) where.createdAt.gte = new Date(opts.startDate);
    if (opts?.endDate) {
      const end = new Date(opts.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const messages = await db.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10000,
    include: {
      org: { select: { name: true } },
      contact: { select: { phone: true, firstName: true, lastName: true } },
      campaign: { select: { name: true } },
    },
  });

  const rows: string[][] = [
    ["Date", "Time", "Organization", "Contact Phone", "Contact Name", "Direction", "Body", "Status", "Segments", "Cost", "Campaign", "Twilio SID"],
  ];

  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    const contactName = [msg.contact?.firstName, msg.contact?.lastName]
      .filter(Boolean)
      .join(" ");
    rows.push([
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      msg.org?.name || "",
      msg.contact?.phone || "",
      contactName,
      msg.direction,
      msg.body || "",
      msg.status,
      String(msg.segmentCount),
      msg.cost ? String(msg.cost) : "",
      msg.campaign?.name || "",
      msg.twilioSid || "",
    ]);
  }

  const csvLines = rows.map((row) =>
    row.map((cell) => {
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(",")
  );

  return {
    csv: csvLines.join("\n"),
    filename: `message-log-${new Date().toISOString().split("T")[0]}.csv`,
  };
}
