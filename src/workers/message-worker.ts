import { Worker, Queue, type Job } from "bullmq";
import { db } from "@/lib/db";
import { getOrgClient } from "@/lib/twilio";
import { renderMergeFields } from "@/server/services/campaign-service";
import { checkAndDeductBalance, calculateMessageCost, syncBalanceToRedis } from "@/server/services/quota-service";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const messageQueue = new Queue("messages", { connection });
export const campaignQueue = new Queue("campaigns", { connection });

interface MessageJobData {
  orgId: string;
  campaignId: string;
  contactId: string;
  messageBody: string;
  mediaUrl?: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface CampaignJobData {
  orgId: string;
  campaignId: string;
  action: "expand" | "complete";
}

/**
 * Message Worker: Sends individual messages via Twilio.
 * Pipeline: check org → check consent → check quiet hours → render merge fields → check balance → send
 */
export const messageWorker = new Worker<MessageJobData>(
  "messages",
  async (job: Job<MessageJobData>) => {
    const { orgId, campaignId, contactId, messageBody, mediaUrl, phone, firstName, lastName } = job.data;

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

    // 2. Check quiet hours (simplified: check if between 8AM-9PM ET)
    const now = new Date();
    const hour = now.getHours(); // Server time, should be adjusted per contact timezone
    if (hour < 8 || hour >= 21) {
      // Re-queue for next send window
      const delayMs = hour >= 21
        ? (24 - hour + 8) * 60 * 60 * 1000
        : (8 - hour) * 60 * 60 * 1000;
      await messageQueue.add("send", job.data, {
        delay: delayMs,
        priority: 5,
      });
      await job.log(`Delayed: quiet hours. Will retry in ${delayMs / 1000 / 60} minutes`);
      return { status: "delayed", reason: "quiet_hours" };
    }

    // 3. Render merge fields
    const renderedBody = renderMergeFields(messageBody, { firstName, lastName, phone }, org.name);

    // 4. Append political disclaimer if configured
    let finalBody = renderedBody;
    if (org.politicalDisclaimer) {
      finalBody = `${renderedBody}\n\n${org.politicalDisclaimer}`;
    }

    // 5. Append opt-out instructions
    if (!finalBody.toLowerCase().includes("stop")) {
      finalBody = `${finalBody}\nReply STOP to opt out.`;
    }

    // 6. Calculate cost and check balance
    const hasMms = !!mediaUrl;
    const segmentCount = Math.ceil(finalBody.length / 153) || 1;

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

    // 8. Send via Twilio
    const twilioMsg = await client.messages.create({
      messagingServiceSid: subaccount.messagingServiceSid,
      to: phone,
      body: finalBody,
      ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
    });

    // 9. Record spend in DB
    await db.messagingPlan.update({
      where: { orgId },
      data: {
        balanceCents: { decrement: 0 }, // Already deducted in Redis; sync keeps them aligned
        totalSpentCents: { increment: costCents },
      },
    });

    // 10. Create message record
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

    // 11. Increment campaign sent count
    await db.campaign.update({
      where: { id: campaignId },
      data: { sentCount: { increment: 1 } },
    });

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

    if (action === "expand") {
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
 * Expand a campaign: resolve segment contacts and create message jobs.
 */
async function expandCampaign(orgId: string, campaignId: string, job: Job) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
    include: { segment: true },
  });

  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.segmentId) throw new Error("No segment assigned");

  // Get segment contacts (opted-in only)
  const segment = await db.segment.findFirst({
    where: { id: campaign.segmentId, orgId },
  });

  if (!segment) throw new Error("Segment not found");

  // Get all opted-in contacts matching segment
  const contacts = await db.contact.findMany({
    where: {
      orgId,
      optInStatus: "OPTED_IN",
    },
    select: { id: true, phone: true, firstName: true, lastName: true },
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

// Error handling
messageWorker.on("failed", (job, err) => {
  console.error(`Message job ${job?.id} failed:`, err.message);
});

campaignWorker.on("failed", (job, err) => {
  console.error(`Campaign job ${job?.id} failed:`, err.message);
});

messageWorker.on("completed", (job) => {
  // Logged via job.log
});

console.log("Message and campaign workers started");
