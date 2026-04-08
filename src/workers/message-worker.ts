import { Worker, Queue, type Job } from "bullmq";
import { db } from "@/lib/db";
import { getOrgClient } from "@/lib/twilio";
import { renderMergeFields } from "@/server/services/campaign-service";
import { checkAndDeductBalance, calculateMessageCost, syncBalanceToRedis } from "@/server/services/quota-service";
import { shortenLinksInMessage } from "@/server/services/link-tracking-service";
import { buildSegmentWhere } from "@/server/services/contact-service";
import { isQuietHours } from "@/server/services/compliance-service";
import { countSegments } from "@/lib/sms-utils";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const messageQueue = new Queue("messages", { connection });
export const campaignQueue = new Queue("campaigns", { connection });

interface MessageJobData {
  orgId: string;
  campaignId?: string;
  contactId: string;
  messageBody: string;
  mediaUrl?: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  messageId?: string; // For quick sends / inbox replies where message record already exists
}

interface CampaignJobData {
  orgId: string;
  campaignId: string;
  action: "expand" | "complete" | "check-scheduled";
}

/**
 * Message Worker: Sends individual messages via Twilio.
 * Pipeline: check org → check consent → check quiet hours → render merge fields → check balance → send
 */
export const messageWorker = new Worker<MessageJobData>(
  "messages",
  async (job: Job<MessageJobData>) => {
    const { orgId, campaignId, contactId, messageBody, mediaUrl, phone } = job.data;

    // 0. Check org is approved
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { status: true, name: true, politicalDisclaimer: true },
    });
    if (!org || org.status !== "ACTIVE") {
      await job.log("Blocked: organization not approved");
      return { status: "blocked", reason: "org_not_approved" };
    }

    // 1. Check consent
    const contact = await db.contact.findFirst({
      where: { id: contactId, orgId },
    });

    if (!contact || contact.optInStatus === "OPTED_OUT") {
      await job.log("Skipped: contact opted out or not found");
      return { status: "skipped", reason: "opted_out" };
    }

    // 2. Check quiet hours (8AM-9PM in recipient timezone, approximated from area code)
    const quietCheck = isQuietHours(phone);
    if (!quietCheck.allowed) {
      // Re-queue for next send window using the delay calculated by the compliance service
      const delayMs = quietCheck.delayUntil
        ? quietCheck.delayUntil.getTime() - Date.now()
        : 8 * 60 * 60 * 1000; // Fallback: 8 hours
      await messageQueue.add("send", job.data, {
        delay: Math.max(delayMs, 0),
        priority: 5,
      });
      await job.log(`Delayed: ${quietCheck.reason}. Will retry in ${Math.round(delayMs / 1000 / 60)} minutes`);
      return { status: "delayed", reason: "quiet_hours" };
    }

    // 3. Render merge fields (use full contact from DB for all merge tags)
    const renderedBody = renderMergeFields(messageBody, contact, org.name);

    // 3.5. Auto-shorten URLs for link tracking
    let trackedBody = renderedBody;
    try {
      trackedBody = await shortenLinksInMessage(orgId, renderedBody, campaignId);
    } catch (err) {
      await job.log(`Link shortening failed, using original URLs: ${err}`);
    }

    // 4. Append political disclaimer if configured
    let finalBody = trackedBody;
    if (org.politicalDisclaimer) {
      finalBody = `${renderedBody}\n\n${org.politicalDisclaimer}`;
    }

    // 5. Append opt-out instructions
    if (!finalBody.toLowerCase().includes("stop")) {
      finalBody = `${finalBody}\nReply STOP to opt out.`;
    }

    // 6. Calculate cost and check balance
    const hasMms = !!mediaUrl;
    const segmentCount = countSegments(finalBody);

    // Get org rates
    const plan = await db.messagingPlan.findUnique({ where: { orgId } });
    const smsRate = plan?.smsRateCents || 4;
    const mmsRate = plan?.mmsRateCents || 8;
    const costCents = calculateMessageCost(segmentCount, hasMms, smsRate, mmsRate);

    const balanceCheck = await checkAndDeductBalance(orgId, costCents);
    if (!balanceCheck.allowed) {
      await job.log(`Blocked: insufficient balance. Need ${costCents}¢, have ${balanceCheck.remainingBalanceCents}¢`);
      return { status: "blocked", reason: "insufficient_balance" };
    }

    // 7. Get Twilio client and messaging service
    const subaccount = await db.twilioSubaccount.findUnique({ where: { orgId } });
    if (!subaccount?.messagingServiceSid) {
      // Refund the balance since we can't send
      await db.messagingPlan.update({
        where: { orgId },
        data: { balanceCents: { increment: costCents } },
      });
      await syncBalanceToRedis(orgId);
      throw new Error("No messaging service configured");
    }

    const client = await getOrgClient(orgId);

    // 8. Send via Twilio (wrapped in try-catch to refund balance on failure)
    let twilioMsg;
    try {
      twilioMsg = await client.messages.create({
        messagingServiceSid: subaccount.messagingServiceSid,
        to: phone,
        body: finalBody,
        ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
      });
    } catch (twilioError) {
      // Refund the deducted balance back to DB + Redis since the send failed
      await db.messagingPlan.update({
        where: { orgId },
        data: { balanceCents: { increment: costCents } },
      });
      await syncBalanceToRedis(orgId);
      await job.log(`Twilio send failed, refunded ${costCents}¢: ${twilioError}`);
      throw twilioError;
    }

    // 9. Record spend in DB
    await db.messagingPlan.update({
      where: { orgId },
      data: {
        balanceCents: { decrement: 0 }, // Already deducted in Redis; sync keeps them aligned
        totalSpentCents: { increment: costCents },
      },
    });

    // 10. Create or update message record
    if (job.data.messageId) {
      // Quick send: update existing message record
      await db.message.update({
        where: { id: job.data.messageId },
        data: {
          twilioSid: twilioMsg.sid,
          status: "SENT",
          segmentCount,
          cost: costCents / 100,
          sentAt: new Date(),
        },
      });
    } else {
      await db.message.create({
        data: {
          orgId,
          campaignId,
          contactId,
          direction: "OUTBOUND",
          body: finalBody,
          mediaUrl,
          twilioSid: twilioMsg.sid,
          status: "QUEUED",
          segmentCount,
          cost: costCents / 100, // Store as dollars
        },
      });
    }

    // 11. Increment campaign sent count (if part of a campaign)
    if (campaignId) {
      await db.campaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } },
      });
    }

    await job.log(`Sent to ${phone}: ${twilioMsg.sid} (cost: ${costCents}¢)`);
    return { status: "sent", twilioSid: twilioMsg.sid, costCents };
  },
  {
    connection,
    concurrency: 10,
    limiter: {
      max: 1, // 1 message per second per number (10DLC limit)
      duration: 1000,
    },
  }
);

/**
 * Campaign Worker: Expands campaigns into individual message jobs.
 */
export const campaignWorker = new Worker<CampaignJobData>(
  "campaigns",
  async (job: Job<CampaignJobData>) => {
    const { orgId, campaignId, action } = job.data;

    if (action === "check-scheduled") {
      return checkScheduledCampaigns(job);
    }

    if (action === "expand") {
      // P2P campaigns must NOT use automated expansion — compliance requirement
      const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { type: true } });
      if (campaign?.type === "P2P") {
        await job.log("P2P campaigns do not use automated expansion. Skipping.");
        return { status: "skipped", reason: "P2P campaigns use agent-initiated sends" };
      }
      return expandCampaign(orgId, campaignId, job);
    }

    if (action === "complete") {
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return { status: "completed" };
    }
  },
  { connection, concurrency: 5 }
);

/**
 * Check for scheduled campaigns that are due to send.
 * Runs every minute via repeatable job.
 */
async function checkScheduledCampaigns(job: Job) {
  const now = new Date();

  const dueCampaigns = await db.campaign.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    include: {
      org: { select: { id: true, status: true } },
    },
  });

  if (dueCampaigns.length === 0) return { triggered: 0 };

  let triggered = 0;

  for (const campaign of dueCampaigns) {
    if (campaign.org.status !== "ACTIVE") {
      await job.log(`Skipping campaign ${campaign.id}: org not active`);
      continue;
    }

    // P2P campaigns: transition to SENDING but skip expansion
    // (agents send individually from their pre-assigned queues)
    if (campaign.type === "P2P") {
      await db.campaign.update({
        where: { id: campaign.id },
        data: { status: "SENDING", startedAt: new Date() },
      });
      triggered++;
      await job.log(`Launched scheduled P2P campaign: ${campaign.name} (${campaign.id}) — agents can now send`);
      continue;
    }

    // Non-P2P: Transition to SENDING and queue expansion
    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "SENDING", startedAt: new Date() },
    });

    await campaignQueue.add("expand", {
      orgId: campaign.orgId,
      campaignId: campaign.id,
      action: "expand" as const,
    });

    triggered++;
    await job.log(`Triggered scheduled campaign: ${campaign.name} (${campaign.id})`);
  }

  return { triggered };
}

// Schedule the campaign checker to run every minute
campaignQueue.add(
  "check-scheduled",
  { orgId: "", campaignId: "", action: "check-scheduled" as const },
  {
    repeat: { pattern: "* * * * *" }, // Every minute
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 10 },
  }
);

/**
 * Expand a campaign: resolve segment contacts and create message jobs.
 */
async function expandCampaign(orgId: string, campaignId: string, job: Job) {
  // Atomic lock: only one worker can transition SENDING -> expanding.
  // If another worker already started expansion, updateMany returns 0 rows
  // and we bail out, preventing duplicate message creation.
  const lockResult = await db.campaign.updateMany({
    where: {
      id: campaignId,
      orgId,
      status: "SENDING",
    },
    data: {
      status: "EXPANDING",
    },
  });

  if (lockResult.count === 0) {
    await job.log(`Campaign ${campaignId} already being expanded by another worker, skipping.`);
    return { status: "skipped", reason: "already_expanding" };
  }

  // Also check if this campaign already has messages (duplicate expansion guard)
  const existingMessages = await db.message.count({
    where: { campaignId },
  });
  if (existingMessages > 0) {
    await job.log(`Campaign ${campaignId} already has ${existingMessages} messages, skipping duplicate expansion.`);
    // Restore to SENDING since messages already exist
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "SENDING" },
    });
    return { status: "skipped", reason: "already_expanded" };
  }

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
    include: { segment: true },
  });

  if (!campaign) throw new Error("Campaign not found");

  // ==========================================
  // RESOLVE TARGET CONTACTS
  // Supports: segment only, interest lists, or both
  // Deduplicates contacts across multiple lists
  // ==========================================
  let contactIds: Set<string>;

  if (campaign.interestListMode === "everyone" && campaign.interestListIds.length === 0) {
    // "Send to everyone" — all opted-in contacts
    const allContacts = await db.contact.findMany({
      where: { orgId, optInStatus: "OPTED_IN" },
      select: { id: true },
    });
    contactIds = new Set(allContacts.map((c: { id: string }) => c.id));
    await job.log(`Targeting all opted-in contacts: ${contactIds.size}`);

  } else if (campaign.interestListMode === "include" && campaign.interestListIds.length > 0) {
    // "Include" — only contacts ON these interest lists
    const members = await db.interestListMember.findMany({
      where: {
        interestListId: { in: campaign.interestListIds },
        contact: { orgId, optInStatus: "OPTED_IN" },
      },
      select: { contactId: true },
    });
    // Set automatically deduplicates contacts on multiple lists
    contactIds = new Set(members.map((m: { contactId: string }) => m.contactId));
    await job.log(`Interest list INCLUDE targeting: ${contactIds.size} unique contacts from ${campaign.interestListIds.length} list(s)`);

  } else if (campaign.interestListMode === "exclude" && campaign.interestListIds.length > 0) {
    // "Exclude" — all opted-in contacts EXCEPT those on these lists
    const [allContacts, excludeMembers] = await Promise.all([
      db.contact.findMany({
        where: { orgId, optInStatus: "OPTED_IN" },
        select: { id: true },
      }),
      db.interestListMember.findMany({
        where: {
          interestListId: { in: campaign.interestListIds },
          contact: { orgId },
        },
        select: { contactId: true },
      }),
    ]);
    const excludeSet = new Set(excludeMembers.map((m: { contactId: string }) => m.contactId));
    contactIds = new Set(allContacts.filter((c: { id: string }) => !excludeSet.has(c.id)).map((c: { id: string }) => c.id));
    await job.log(`Interest list EXCLUDE targeting: ${contactIds.size} contacts (excluded ${excludeSet.size} from ${campaign.interestListIds.length} list(s))`);

  } else if (campaign.segmentId && campaign.segment) {
    // Segment-only targeting — apply segment filter rules and require opt-in
    const segmentWhere = buildSegmentWhere(orgId, campaign.segment.rules as any);
    const contacts = await db.contact.findMany({
      where: {
        ...segmentWhere,
        optInStatus: "OPTED_IN",
      },
      select: { id: true },
    });
    contactIds = new Set(contacts.map((c: { id: string }) => c.id));
    await job.log(`Segment targeting (${campaign.segment.name}): ${contactIds.size} contacts match segment rules`);

  } else {
    throw new Error("No targeting configured — no segment or interest lists selected");
  }

  if (contactIds.size === 0) {
    await job.log("No contacts to send to — campaign has 0 eligible recipients");
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "COMPLETED", completedAt: new Date(), totalRecipients: 0 },
    });
    return { status: "completed", messageCount: 0 };
  }

  // Fetch contact details for message jobs
  const contacts = await db.contact.findMany({
    where: { id: { in: Array.from(contactIds) } },
    select: { id: true, phone: true, firstName: true, lastName: true },
  });

  // Update total recipients and transition back to SENDING
  await db.campaign.update({
    where: { id: campaignId },
    data: { totalRecipients: contacts.length, status: "SENDING" },
  });

  await job.log(`Expanding campaign to ${contacts.length} contacts`);

  // Create message jobs in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const jobs = batch.map((contact) => ({
      name: "send",
      data: {
        orgId,
        campaignId,
        contactId: contact.id,
        messageBody: campaign.messageBody,
        mediaUrl: campaign.mediaUrl || undefined,
        phone: contact.phone,
        firstName: contact.firstName,
        lastName: contact.lastName,
      } as MessageJobData,
      opts: { priority: 10 },
    }));

    await messageQueue.addBulk(jobs);
    await job.updateProgress(Math.min(100, Math.round(((i + BATCH_SIZE) / contacts.length) * 100)));
  }

  await job.log(`Created ${contacts.length} message jobs`);

  // Schedule a completion check
  await campaignQueue.add(
    "complete",
    { orgId, campaignId, action: "complete" as const },
    { delay: contacts.length * 1500 } // Rough estimate: 1.5 sec per message
  );

  return { status: "expanded", messageCount: contacts.length };
}

// ============================================================
// PHONE NUMBER BILLING WORKER
// Runs daily, charges $5/month per active phone number
// ============================================================

/**
 * Convert a UTC Date to year/month/day in a specific IANA timezone.
 * Uses Node.js built-in Intl so no external library is needed.
 */
function getDateInTimezone(date: Date, timezone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === 'year')!.value),
    month: parseInt(parts.find(p => p.type === 'month')!.value),
    day: parseInt(parts.find(p => p.type === 'day')!.value),
  };
}

export const billingQueue = new Queue("billing", { connection });

export const billingWorker = new Worker(
  "billing",
  async (job: Job) => {
    if (job.name !== "phone-number-fees") return;

    const now = new Date();

    // Find all active phone numbers
    const phoneNumbers = await db.phoneNumber.findMany({
      where: { status: "ACTIVE" },
      include: {
        org: {
          select: { timezone: true, messagingPlan: true },
        },
      },
    });

    let charged = 0;
    let skipped = 0;

    for (const pn of phoneNumbers) {
      const plan = pn.org.messagingPlan;
      if (!plan) {
        skipped++;
        continue;
      }

      // Use the org's timezone (default to America/New_York if unset)
      const tz = pn.org.timezone || "America/New_York";
      const today = getDateInTimezone(now, tz);

      // Determine if this number is due for a charge today.
      // Charge on the same calendar date each month as the original provision date.
      const chargeDate = pn.lastChargedAt || pn.createdAt;
      const chargeDateLocal = getDateInTimezone(new Date(chargeDate), tz);
      const billingDayOfMonth = chargeDateLocal.day;

      // Check if today is the billing day (or past it, for months with fewer days)
      const lastDayOfMonth = new Date(today.year, today.month, 0).getDate();
      const effectiveBillingDay = Math.min(billingDayOfMonth, lastDayOfMonth);

      if (today.day !== effectiveBillingDay) {
        continue; // Not this number's billing day
      }

      // Check if already charged this month (in org-local timezone)
      if (pn.lastChargedAt) {
        const lastChargedLocal = getDateInTimezone(new Date(pn.lastChargedAt), tz);
        if (
          lastChargedLocal.month === today.month &&
          lastChargedLocal.year === today.year
        ) {
          continue; // Already charged this month
        }
      }

      const feeCents = plan.phoneNumberFeeCents || 500;

      if (plan.balanceCents >= feeCents) {
        await db.$transaction([
          db.messagingPlan.update({
            where: { orgId: pn.orgId },
            data: {
              balanceCents: { decrement: feeCents },
              totalSpentCents: { increment: feeCents },
            },
          }),
          db.phoneNumber.update({
            where: { id: pn.id },
            data: { lastChargedAt: now },
          }),
        ]);

        await syncBalanceToRedis(pn.orgId);
        charged++;
      } else {
        console.warn(`[BILLING] Insufficient balance for phone ${pn.phoneNumber} (org ${pn.orgId}). Need ${feeCents}¢, have ${plan.balanceCents}¢`);
        skipped++;
      }
    }

    await job.log(`Phone billing: charged ${charged}, skipped ${skipped}`);
    return { charged, skipped };
  },
  { connection, concurrency: 1 }
);

// Schedule daily phone number billing check
billingQueue.add(
  "phone-number-fees",
  {},
  {
    repeat: { pattern: "0 6 * * *" }, // 6 AM daily
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  }
);

// Error handling
messageWorker.on("failed", (job, err) => {
  console.error(`Message job ${job?.id} failed:`, err.message);
});

campaignWorker.on("failed", (job, err) => {
  console.error(`Campaign job ${job?.id} failed:`, err.message);
});

billingWorker.on("failed", (job, err) => {
  console.error(`Billing job ${job?.id} failed:`, err.message);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
messageWorker.on("completed", (_job) => {
  // Logged via job.log
});

console.info("Message, campaign, and billing workers started");
