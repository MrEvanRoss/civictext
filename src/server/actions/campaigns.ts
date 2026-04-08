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
  return changeCampaignStatus(orgId, campaignId, newStatus);
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

  if (!data.messageBody.trim() && !data.mediaUrl) {
    throw new Error("Message body or media is required");
  }

  // Validate phone number
  const parsed = parsePhoneNumberFromString(data.phone, "US");
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
        optInStatus: "OPTED_IN",
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
      body: data.messageBody,
      mediaUrl: data.mediaUrl || null,
      status: "QUEUED",
    },
  });

  // Queue for sending (priority 1 = immediate)
  await messageQueue.add("send", {
    orgId,
    contactId: contact.id,
    messageBody: data.messageBody,
    mediaUrl: data.mediaUrl || undefined,
    phone: e164Phone,
    firstName: contact.firstName,
    lastName: contact.lastName,
    messageId: message.id,
  }, { priority: 1 });

  return { messageId: message.id, phone: e164Phone };
}
