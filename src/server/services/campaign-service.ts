import { db } from "@/lib/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignFilter,
} from "@/lib/validators/campaigns";
import type { Prisma } from "@prisma/client";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const campaignQueue = new Queue("campaigns", { connection });
const messageQueue = new Queue("messages", { connection });

/**
 * List campaigns with optional filtering.
 */
export async function listCampaigns(orgId: string, filter: CampaignFilter) {
  const where: Prisma.CampaignWhereInput = { orgId };

  if (filter.status) where.status = filter.status;
  if (filter.type) where.type = filter.type;

  const [campaigns, total] = await Promise.all([
    db.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      include: {
        segment: { select: { name: true, contactCount: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.campaign.count({ where }),
  ]);

  return {
    campaigns,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.ceil(total / filter.pageSize),
  };
}

/**
 * Get a single campaign with details.
 */
export async function getCampaign(orgId: string, campaignId: string) {
  return db.campaign.findFirst({
    where: { id: campaignId, orgId },
    include: {
      segment: true,
      dripSteps: { orderBy: { stepOrder: "asc" } },
      createdBy: { select: { name: true, email: true } },
    },
  });
}

/**
 * Get campaign stats (message counts by status).
 */
export async function getCampaignStats(orgId: string, campaignId: string) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
    select: {
      sentCount: true,
      deliveredCount: true,
      failedCount: true,
      responseCount: true,
      optOutCount: true,
    },
  });

  return campaign;
}

/**
 * Create a new campaign.
 */
export async function createCampaign(
  orgId: string,
  userId: string,
  input: CreateCampaignInput
) {
  return db.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        orgId,
        name: input.name,
        type: input.type,
        status: "DRAFT",
        messageBody: input.messageBody,
        mediaUrl: input.mediaUrl,
        segmentId: input.segmentId,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        createdById: userId,
      },
    });

    // Create drip steps if drip campaign
    if (input.type === "DRIP" && input.dripSteps?.length) {
      await tx.dripStep.createMany({
        data: input.dripSteps.map((step) => ({
          orgId,
          campaignId: campaign.id,
          stepOrder: step.stepOrder,
          messageBody: step.messageBody,
          mediaUrl: step.mediaUrl,
          delayMinutes: step.delayMinutes,
        })),
      });
    }

    // Create auto-reply rules if auto-reply campaign
    if (input.type === "AUTO_REPLY" && input.autoReplyRules?.length) {
      await tx.autoReplyRule.createMany({
        data: input.autoReplyRules.map((rule, i) => ({
          orgId,
          name: `${input.name} - Rule ${i + 1}`,
          keywords: rule.keywords,
          replyBody: rule.replyBody,
          priority: rule.priority,
          isActive: true,
        })),
      });
    }

    return campaign;
  });
}

/**
 * Update campaign (only if DRAFT or PAUSED).
 */
export async function updateCampaign(
  orgId: string,
  input: UpdateCampaignInput
) {
  const existing = await db.campaign.findFirst({
    where: { id: input.id, orgId },
  });

  if (!existing) throw new Error("Campaign not found");
  if (!["DRAFT", "PAUSED"].includes(existing.status)) {
    throw new Error("Can only edit campaigns in DRAFT or PAUSED status");
  }

  const data: Prisma.CampaignUpdateInput = {};
  if (input.name) data.name = input.name;
  if (input.messageBody) data.messageBody = input.messageBody;
  if (input.mediaUrl !== undefined) data.mediaUrl = input.mediaUrl || null;
  if (input.segmentId) data.segment = { connect: { id: input.segmentId } };
  if (input.scheduledAt) data.scheduledAt = new Date(input.scheduledAt);

  return db.campaign.update({
    where: { id: input.id },
    data,
  });
}

/**
 * Change campaign status (state machine enforcement).
 */
export async function changeCampaignStatus(
  orgId: string,
  campaignId: string,
  newStatus: string
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
  });

  if (!campaign) throw new Error("Campaign not found");

  // State machine transitions
  const validTransitions: Record<string, string[]> = {
    DRAFT: ["SCHEDULED", "SENDING"],
    SCHEDULED: ["SENDING", "CANCELLED"],
    SENDING: ["PAUSED", "COMPLETED", "CANCELLED"],
    PAUSED: ["SENDING", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  const allowed = validTransitions[campaign.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot transition from ${campaign.status} to ${newStatus}`
    );
  }

  const data: Prisma.CampaignUpdateInput = { status: newStatus as any };

  if (newStatus === "SENDING" && !campaign.startedAt) {
    data.startedAt = new Date();
  }
  if (newStatus === "COMPLETED") {
    data.completedAt = new Date();
  }

  const updated = await db.campaign.update({
    where: { id: campaignId },
    data,
  });

  // When transitioning to SENDING, queue the campaign expansion
  if (newStatus === "SENDING") {
    await campaignQueue.add("expand", {
      orgId,
      campaignId,
      action: "expand",
    });
  }

  return updated;
}

/**
 * Duplicate a campaign as a new draft.
 */
export async function duplicateCampaign(
  orgId: string,
  campaignId: string,
  userId: string
) {
  const original = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
    include: {
      dripSteps: true,
    },
  });

  if (!original) throw new Error("Campaign not found");

  return db.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        orgId,
        name: `${original.name} (Copy)`,
        type: original.type,
        status: "DRAFT",
        messageBody: original.messageBody,
        mediaUrl: original.mediaUrl,
        segmentId: original.segmentId,
        createdById: userId,
      },
    });

    if (original.dripSteps.length > 0) {
      await tx.dripStep.createMany({
        data: original.dripSteps.map((step) => ({
          orgId,
          campaignId: campaign.id,
          stepOrder: step.stepOrder,
          messageBody: step.messageBody,
          mediaUrl: step.mediaUrl,
          delayMinutes: step.delayMinutes,
        })),
      });
    }

    return campaign;
  });
}

/**
 * Render merge fields in a message template.
 */
export function renderMergeFields(
  template: string,
  contact: { firstName?: string | null; lastName?: string | null; phone: string },
  orgName?: string
): string {
  return template
    .replace(/\{\{firstName\}\}/g, contact.firstName || "Friend")
    .replace(/\{\{lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{phone\}\}/g, contact.phone)
    .replace(/\{\{orgName\}\}/g, orgName || "");
}

/**
 * Count SMS segments in a message.
 */
export function countSegments(message: string): number {
  const hasUnicode = /[^\x00-\x7F]/.test(message);
  const len = message.length;

  if (hasUnicode) {
    return len <= 70 ? 1 : Math.ceil(len / 67);
  }
  return len <= 160 ? 1 : Math.ceil(len / 153);
}
