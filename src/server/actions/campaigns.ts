"use server";

import { requireOrg, requirePermission } from "./auth";
import {
  listCampaigns,
  getCampaign,
  getCampaignStats,
  createCampaign,
  updateCampaign,
  changeCampaignStatus,
  duplicateCampaign,
} from "@/server/services/campaign-service";
import {
  campaignFilterSchema,
  createCampaignSchema,
  updateCampaignSchema,
  type CampaignFilter,
  type CreateCampaignInput,
  type UpdateCampaignInput,
} from "@/lib/validators/campaigns";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

const campaignStatusSchema = z.enum([
  "DRAFT", "SCHEDULED", "SENDING", "PAUSED", "COMPLETED", "CANCELLED",
]);

const sendTestMessageSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  messageBody: z.string().max(1600),
  mediaUrl: z.string().url().optional().or(z.literal("")),
});

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const messageQueue = new Queue("messages", { connection });

/**
 * Get the campaign types this org is allowed to use.
 */
export async function getAllowedCampaignTypesAction(): Promise<string[]> {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { allowedCampaignTypes: true },
  });

  return org?.allowedCampaignTypes || ["BROADCAST", "P2P", "GOTV", "DRIP", "AUTO_REPLY"];
}

export async function listCampaignsAction(filter: Partial<CampaignFilter>) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const validated = campaignFilterSchema.parse(filter);
  return listCampaigns(orgId, validated);
}

export async function getCampaignAction(campaignId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  return getCampaign(orgId, campaignId);
}

export async function getCampaignStatsAction(campaignId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  return getCampaignStats(orgId, campaignId);
}

export async function createCampaignAction(input: CreateCampaignInput) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const userId = (session.user as any).id;
  const validated = createCampaignSchema.parse(input);
  return createCampaign(orgId, userId, validated);
}

export async function updateCampaignAction(input: UpdateCampaignInput) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const validated = updateCampaignSchema.parse(input);
  return updateCampaign(orgId, validated);
}

export async function changeCampaignStatusAction(
  campaignId: string,
  newStatus: string
) {
  await requirePermission(PERMISSIONS.CAMPAIGN_SEND);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(campaignId);
  const validatedStatus = campaignStatusSchema.parse(newStatus);

  return changeCampaignStatus(orgId, campaignId, validatedStatus);
}

export async function duplicateCampaignAction(campaignId: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const userId = (session.user as any).id;
  return duplicateCampaign(orgId, campaignId, userId);
}

/**
 * Export campaign message-level data as CSV.
 */
export async function exportCampaignAction(campaignId: string) {
  await requirePermission(PERMISSIONS.DATA_EXPORT);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const campaign = await getCampaign(orgId, campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const { db } = await import("@/lib/db");

  const messages = await db.message.findMany({
    where: { orgId, campaignId },
    orderBy: { createdAt: "asc" },
    include: {
      contact: {
        select: { phone: true, firstName: true, lastName: true, email: true, precinct: true, tags: true },
      },
    },
    take: 50000,
  });

  const rows: string[][] = [
    ["Date", "Time", "Phone", "First Name", "Last Name", "Email", "Precinct", "Tags", "Direction", "Body", "Status", "Segments", "Cost"],
  ];

  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    rows.push([
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      msg.contact?.phone || "",
      msg.contact?.firstName || "",
      msg.contact?.lastName || "",
      msg.contact?.email || "",
      msg.contact?.precinct || "",
      msg.contact?.tags?.join("; ") || "",
      msg.direction,
      msg.body || "",
      msg.status,
      String(msg.segmentCount),
      msg.cost ? String(msg.cost) : "",
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
    filename: `campaign-${campaign.name.replace(/[^a-zA-Z0-9]/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`,
  };
}

/**
 * Get link tracking stats for a campaign.
 * Returns per-link click counts and overall CTR.
 */
export async function getCampaignLinkStatsAction(campaignId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const { getCampaignLinkStats } = await import(
    "@/server/services/link-tracking-service"
  );

  const links = await getCampaignLinkStats(orgId, campaignId);

  const totalClicks = links.reduce((sum, l) => sum + l.clickCount, 0);
  const uniqueUrls = new Set(links.map((l) => l.originalUrl)).size;

  return {
    links: links.map((l) => ({
      id: l.id,
      originalUrl: l.originalUrl,
      shortCode: l.shortCode,
      clickCount: l.clickCount,
      createdAt: l.createdAt.toISOString(),
    })),
    totalClicks,
    totalLinks: links.length,
    uniqueUrls,
  };
}

/**
 * Send a test message to a specific phone number.
 * Uses balance just like a normal message.
 */
export async function sendTestMessageAction(data: {
  phone: string;
  messageBody: string;
  mediaUrl?: string;
}) {
  await requirePermission(PERMISSIONS.CAMPAIGN_SEND);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const validated = sendTestMessageSchema.parse(data);

  if (!validated.messageBody.trim() && !validated.mediaUrl) {
    throw new Error("Message body or media is required");
  }

  // Validate phone number
  const parsed = parsePhoneNumberFromString(validated.phone, "US");
  if (!parsed || !parsed.isValid()) {
    throw new Error("Invalid phone number. Use a valid US phone number.");
  }
  const e164Phone = parsed.format("E.164");

  // Find or create contact for this phone
  let contact = await db.contact.findFirst({
    where: { orgId, phone: e164Phone },
  });

  if (!contact) {
    contact = await db.contact.create({
      data: {
        orgId,
        phone: e164Phone,
        optInStatus: "PENDING",
        optInSource: "test_message",
        optInTimestamp: new Date(),
      },
    });
  }

  // Create message record
  const message = await db.message.create({
    data: {
      orgId,
      contactId: contact.id,
      direction: "OUTBOUND",
      body: validated.messageBody,
      mediaUrl: validated.mediaUrl || null,
      status: "QUEUED",
    },
  });

  // Queue for sending (priority 1 = immediate)
  await messageQueue.add("send", {
    orgId,
    contactId: contact.id,
    messageBody: validated.messageBody,
    mediaUrl: validated.mediaUrl || undefined,
    phone: e164Phone,
    firstName: contact.firstName,
    lastName: contact.lastName,
    messageId: message.id,
  }, { priority: 1 });

  return { messageId: message.id, phone: e164Phone };
}

// ---------------------------------------------------------------------------
// Scheduled campaigns actions
// ---------------------------------------------------------------------------

/**
 * Get campaigns with status SCHEDULED.
 * If month/year provided, filter to that calendar month (in the org's timezone).
 * Otherwise return all upcoming scheduled campaigns.
 */
export async function getScheduledCampaignsAction(month?: number, year?: number) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  // Get org timezone
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  const timezone = org?.timezone || "America/New_York";

  const where: any = {
    orgId,
    status: "SCHEDULED",
    scheduledAt: { not: null },
  };

  if (month != null && year != null) {
    // Build start/end of the month in the org's timezone, then convert to UTC
    // We need the full calendar grid range (prev month days + next month days),
    // so we widen the window by ~7 days on each side.
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
    // Widen by 7 days for calendar grid edges
    const rangeStart = new Date(startOfMonth);
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date(endOfMonth);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

    where.scheduledAt = {
      gte: rangeStart,
      lte: rangeEnd,
    };
  }

  const campaigns = await db.campaign.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: {
      segment: { select: { name: true, contactCount: true } },
    },
  });

  return { campaigns, timezone };
}

/**
 * Reschedule a campaign by updating its scheduledAt date.
 */
export async function rescheduleCampaignAction(campaignId: string, newDate: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_SEND);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(campaignId);
  const parsedDate = new Date(newDate);
  if (isNaN(parsedDate.getTime())) {
    throw new Error("Invalid date");
  }

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
  });

  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "SCHEDULED") {
    throw new Error("Can only reschedule campaigns with SCHEDULED status");
  }

  return db.campaign.update({
    where: { id: campaignId },
    data: { scheduledAt: parsedDate },
  });
}

/**
 * Cancel a scheduled campaign.
 */
export async function cancelScheduledCampaignAction(campaignId: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_SEND);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(campaignId);

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
  });

  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "SCHEDULED") {
    throw new Error("Can only cancel campaigns with SCHEDULED status");
  }

  return db.campaign.update({
    where: { id: campaignId },
    data: { status: "CANCELLED" },
  });
}

/**
 * Send a scheduled campaign immediately.
 * Sets status to SENDING and clears scheduledAt.
 */
export async function sendNowAction(campaignId: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_SEND);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(campaignId);

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
  });

  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "SCHEDULED") {
    throw new Error("Can only send campaigns with SCHEDULED status");
  }

  return changeCampaignStatus(orgId, campaignId, "SENDING");
}
