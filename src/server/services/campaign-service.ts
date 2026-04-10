import { db } from "@/lib/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignFilter,
} from "@/lib/validators/campaigns";
import type { Prisma, CampaignStatus } from "@prisma/client";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const campaignQueue = new Queue("campaigns", { connection });

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
        interestListMode: input.interestListMode,
        interestListIds: input.interestListIds || [],
        p2pScript: input.p2pScript,
        p2pReplyScript: input.p2pReplyScript,
        p2pContactsPerAgent: input.p2pContactsPerAgent,
        settings: input.gotvSettings ? { gotv: input.gotvSettings } : undefined,
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
  if (input.segmentId) {
    data.segment = { connect: { id: input.segmentId } };
  } else if (input.segmentId === undefined && input.interestListMode) {
    // Clear segment when switching to interest list targeting
    data.segment = { disconnect: true };
  }
  if (input.scheduledAt) data.scheduledAt = new Date(input.scheduledAt);
  if (input.scheduledAt === undefined) data.scheduledAt = null;

  // Interest list targeting
  if (input.interestListMode !== undefined) data.interestListMode = input.interestListMode || null;
  if (input.interestListIds !== undefined) data.interestListIds = input.interestListIds || [];

  // P2P fields
  if (input.p2pScript !== undefined) data.p2pScript = input.p2pScript || null;
  if (input.p2pReplyScript !== undefined) data.p2pReplyScript = input.p2pReplyScript || null;

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
  // State machine transitions
  const validTransitions: Record<string, string[]> = {
    DRAFT: ["SCHEDULED", "SENDING"],
    SCHEDULED: ["SENDING", "CANCELLED"],
    SENDING: ["PAUSED", "COMPLETED", "CANCELLED"],
    PAUSED: ["SENDING", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  // M-9: Atomic compare-and-swap — the WHERE includes the expected current
  // status so another concurrent transition can't sneak in between read and write.
  const data: Prisma.CampaignUpdateInput = { status: newStatus as CampaignStatus };

  if (newStatus === "SENDING") {
    data.startedAt = new Date();
  }
  if (newStatus === "COMPLETED") {
    data.completedAt = new Date();
  }

  // Build an array of valid source statuses for this target
  const validSources = Object.entries(validTransitions)
    .filter(([, targets]) => targets.includes(newStatus))
    .map(([source]) => source);

  if (validSources.length === 0) {
    throw new Error(`No valid transitions lead to ${newStatus}`);
  }

  const result = await db.campaign.updateMany({
    where: {
      id: campaignId,
      orgId,
      status: { in: validSources as CampaignStatus[] },
    },
    data,
  });

  if (result.count === 0) {
    throw new Error(
      `Cannot transition campaign to ${newStatus} — campaign not found or status has already changed`
    );
  }

  const updated = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
  });
  if (!updated) throw new Error("Campaign not found after update");

  // When transitioning to SENDING, queue the campaign expansion
  // P2P campaigns skip expansion — agents send individually via assignContactsToAgents
  if (newStatus === "SENDING" && updated.type !== "P2P") {
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
        interestListMode: original.interestListMode,
        interestListIds: original.interestListIds,
        p2pScript: original.p2pScript,
        p2pReplyScript: original.p2pReplyScript,
        p2pContactsPerAgent: original.p2pContactsPerAgent,
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
 * Available merge tags:
 * {{prefix}}      - Mr., Mrs., Dr., etc.
 * {{firstName}}   - First name (defaults to "Friend")
 * {{lastName}}    - Last name
 * {{suffix}}      - Jr., Sr., III, etc.
 * {{fullName}}    - Prefix + First + Last + Suffix
 * {{phone}}       - Phone number
 * {{email}}       - Email address
 * {{street}}      - Street address
 * {{city}}        - City
 * {{state}}       - State
 * {{zip}}         - ZIP code
 * {{address}}     - Full address (street, city, state zip)
 * {{precinct}}    - Precinct/district
 * {{orgName}}     - Organization name
 *
 * GOTV fields (resolved from campaign settings + polling location directory):
 * {{pollingLocation}} - Polling place name and address for the contact's precinct
 * {{electionDate}}    - Election date from campaign GOTV settings
 * {{pollHours}}       - Full poll hours string (e.g. "7:00 AM - 8:00 PM")
 * {{pollCloseTime}}   - Poll closing time
 * {{earlyVoteEnd}}    - Early voting end date
 */

export interface GotvContext {
  electionDate?: string;
  earlyVoteEnd?: string;
  pollOpenTime?: string;
  pollCloseTime?: string;
  defaultPollingLocation?: string;
  // Legacy field — kept for backward compatibility with older campaigns
  pollHours?: string;
  // Resolved from PollingLocation table for this contact's precinct:
  resolvedLocationName?: string;
  resolvedLocationAddress?: string;
  resolvedPollOpen?: string;
  resolvedPollClose?: string;
}

export function renderMergeFields(
  template: string,
  contact: {
    prefix?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    suffix?: string | null;
    phone: string;
    email?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    precinct?: string | null;
  },
  orgName?: string,
  gotvContext?: GotvContext
): string {
  const fullName = [
    contact.prefix,
    contact.firstName,
    contact.lastName,
    contact.suffix,
  ].filter(Boolean).join(" ") || "Friend";

  const address = [
    contact.street,
    [contact.city, contact.state].filter(Boolean).join(", "),
    contact.zip,
  ].filter(Boolean).join(", ");

  let result = template
    .replace(/\{\{prefix\}\}/g, contact.prefix || "")
    .replace(/\{\{firstName\}\}/g, contact.firstName || "Friend")
    .replace(/\{\{lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{suffix\}\}/g, contact.suffix || "")
    .replace(/\{\{fullName\}\}/g, fullName)
    .replace(/\{\{phone\}\}/g, contact.phone)
    .replace(/\{\{email\}\}/g, contact.email || "")
    .replace(/\{\{street\}\}/g, contact.street || "")
    .replace(/\{\{city\}\}/g, contact.city || "")
    .replace(/\{\{state\}\}/g, contact.state || "")
    .replace(/\{\{zip\}\}/g, contact.zip || "")
    .replace(/\{\{address\}\}/g, address)
    .replace(/\{\{precinct\}\}/g, contact.precinct || "")
    .replace(/\{\{orgName\}\}/g, orgName || "");

  // GOTV merge field resolution
  if (gotvContext) {
    // Polling location: precinct-specific if available, otherwise campaign default
    const locationDisplay = gotvContext.resolvedLocationName
      ? `${gotvContext.resolvedLocationName}, ${gotvContext.resolvedLocationAddress}`
      : gotvContext.defaultPollingLocation || "";

    // Poll hours: precinct-specific if available, otherwise campaign defaults
    const openTime = gotvContext.resolvedPollOpen || gotvContext.pollOpenTime || "";
    const closeTime = gotvContext.resolvedPollClose || gotvContext.pollCloseTime || "";
    const pollHours = openTime && closeTime
      ? `${formatTimeMerge(openTime)} - ${formatTimeMerge(closeTime)}`
      : gotvContext.pollHours || "";

    result = result
      .replace(/\{\{pollingLocation\}\}/g, locationDisplay)
      .replace(/\{\{electionDate\}\}/g, gotvContext.electionDate ? formatDateMerge(gotvContext.electionDate) : "")
      .replace(/\{\{pollHours\}\}/g, pollHours)
      .replace(/\{\{pollCloseTime\}\}/g, closeTime ? formatTimeMerge(closeTime) : "")
      .replace(/\{\{earlyVoteEnd\}\}/g, gotvContext.earlyVoteEnd ? formatDateMerge(gotvContext.earlyVoteEnd) : "");
  }

  return result;
}

/**
 * Format a date string (YYYY-MM-DD) into a friendly display format.
 * e.g. "2026-11-03" -> "Tuesday, November 3"
 */
function formatDateMerge(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

/**
 * Format a time string into a friendly display format.
 * Accepts "HH:mm" (24h) or "H:mm AM/PM". Returns "H:mm AM/PM".
 */
function formatTimeMerge(timeStr: string): string {
  if (!timeStr) return "";
  if (/[AP]M/i.test(timeStr)) return timeStr;
  try {
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  } catch {
    return timeStr;
  }
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

/**
 * Recover stale campaigns that have been stuck in SENDING status.
 * A campaign is considered stale if it has been in SENDING for more than
 * the specified threshold with no new messages created.
 *
 * Call this from a periodic cron/worker job.
 */
export async function recoverStaleCampaigns(staleThresholdMinutes: number = 60) {
  const threshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);

  const staleCampaigns = await db.campaign.findMany({
    where: {
      status: "SENDING",
      startedAt: { lt: threshold },
    },
    select: {
      id: true,
      orgId: true,
      name: true,
      totalRecipients: true,
      startedAt: true,
      _count: { select: { messages: true } },
    },
  });

  const recovered: string[] = [];

  for (const campaign of staleCampaigns) {
    // If all messages have been processed, mark completed
    const sentCount = campaign._count.messages;
    if (sentCount >= (campaign.totalRecipients || 0)) {
      await db.campaign.update({
        where: { id: campaign.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      recovered.push(campaign.id);
      console.info(
        `[CAMPAIGN RECOVERY] Completed stale campaign ${campaign.id} (${campaign.name}) — ${sentCount}/${campaign.totalRecipients} messages`
      );
    }
  }

  return { checked: staleCampaigns.length, recovered: recovered.length };
}
