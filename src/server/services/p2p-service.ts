import { db } from "@/lib/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { renderMergeFields } from "./campaign-service";
import { runComplianceChecks } from "./compliance-service";
import { P2P_SUSPICIOUS_MIN_INTERVAL_MS } from "@/lib/constants";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

const messageQueue = new Queue("messages", { connection });

/**
 * Distributes opted-in contacts from a campaign's segment across agents.
 * Round-robin assignment with randomized contact order.
 */
export async function assignContactsToAgents(
  orgId: string,
  campaignId: string,
  agentIds: string[],
  contactsPerAgent?: number
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId, type: "P2P" },
    include: { segment: true },
  });
  if (!campaign) throw new Error("Campaign not found or not P2P type");
  if (agentIds.length === 0) throw new Error("At least one agent is required");

  // Resolve target contacts (segment, interest lists, or both)
  let contacts: Array<{ id: string }>;

  if (campaign.interestListMode === "include" && campaign.interestListIds.length > 0) {
    // Include: only contacts on selected interest lists
    const members = await db.interestListMember.findMany({
      where: {
        interestListId: { in: campaign.interestListIds },
        contact: { orgId, optInStatus: "OPTED_IN" },
      },
      select: { contactId: true },
    });
    // Deduplicate contacts who are on multiple lists
    const uniqueIds = Array.from(new Set(members.map((m: { contactId: string }) => m.contactId)));
    contacts = uniqueIds.map((id) => ({ id }));
  } else if (campaign.interestListMode === "exclude" && campaign.interestListIds.length > 0) {
    // Exclude: all opted-in contacts except those on selected lists
    const [allContacts, excludeMembers] = await Promise.all([
      db.contact.findMany({ where: { orgId, optInStatus: "OPTED_IN" }, select: { id: true } }),
      db.interestListMember.findMany({
        where: { interestListId: { in: campaign.interestListIds }, contact: { orgId } },
        select: { contactId: true },
      }),
    ]);
    const excludeSet = new Set(excludeMembers.map((m: { contactId: string }) => m.contactId));
    contacts = allContacts.filter((c: { id: string }) => !excludeSet.has(c.id));
  } else {
    // Segment-only or "everyone"
    if (!campaign.segmentId && campaign.interestListMode !== "everyone") {
      throw new Error("Campaign has no segment or interest list targeting");
    }
    contacts = await db.contact.findMany({
      where: { orgId, optInStatus: "OPTED_IN" },
      select: { id: true },
    });
  }

  // Shuffle contacts for even distribution
  const shuffled = contacts.sort(() => Math.random() - 0.5);

  // Apply per-agent limit if set
  const maxPerAgent = contactsPerAgent || Math.ceil(shuffled.length / agentIds.length);
  const totalAssignable = Math.min(shuffled.length, maxPerAgent * agentIds.length);

  // Round-robin assignment
  const assignments: Array<{
    orgId: string;
    campaignId: string;
    contactId: string;
    assignedToId: string;
  }> = [];

  for (let i = 0; i < totalAssignable; i++) {
    const agentIndex = i % agentIds.length;
    // Check per-agent cap
    const agentAssignmentCount = assignments.filter(
      (a) => a.assignedToId === agentIds[agentIndex]
    ).length;
    if (agentAssignmentCount >= maxPerAgent) continue;

    assignments.push({
      orgId,
      campaignId,
      contactId: shuffled[i].id,
      assignedToId: agentIds[agentIndex],
    });
  }

  // Bulk create assignments
  const result = await db.p2PAssignment.createMany({
    data: assignments,
    skipDuplicates: true,
  });

  // Update campaign total recipients
  await db.campaign.update({
    where: { id: campaignId },
    data: { totalRecipients: result.count },
  });

  return { assignedCount: result.count, agentCount: agentIds.length };
}

/**
 * Returns the next PENDING assignments for an agent.
 * Merge fields are pre-rendered for each contact.
 */
export async function getNextBatch(
  orgId: string,
  campaignId: string,
  agentUserId: string,
  batchSize: number = 1
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId, type: "P2P" },
    include: { org: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  if (campaign.status === "SCHEDULED") {
    const launchTime = campaign.scheduledAt
      ? new Date(campaign.scheduledAt).toLocaleString()
      : "the scheduled time";
    throw new Error(`This campaign is scheduled to launch at ${launchTime}. Please wait until then to start sending.`);
  }
  if (campaign.status === "DRAFT") {
    throw new Error("This campaign has not been launched yet.");
  }
  if (campaign.status === "PAUSED") {
    throw new Error("This campaign is currently paused.");
  }
  if (campaign.status === "COMPLETED" || campaign.status === "CANCELLED") {
    throw new Error("This campaign is no longer active.");
  }

  const assignments = await db.p2PAssignment.findMany({
    where: {
      campaignId,
      assignedToId: agentUserId,
      status: "PENDING",
    },
    include: {
      contact: true,
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  // Get the script (p2pScript takes precedence over messageBody)
  const script = campaign.p2pScript || campaign.messageBody;

  // Render merge fields for each assignment
  return assignments.map((assignment) => ({
    assignmentId: assignment.id,
    contact: assignment.contact,
    renderedBody: renderMergeFields(script, assignment.contact, campaign.org.name),
    replyScript: campaign.p2pReplyScript
      ? renderMergeFields(campaign.p2pReplyScript, assignment.contact, campaign.org.name)
      : null,
    mediaUrl: campaign.mediaUrl,
    originalScript: script,
  }));
}

/**
 * Sends a single P2P message. This is the ONLY path for P2P sends.
 * Every call represents one human-initiated action.
 * No synchronous rate limiting — the message worker handles carrier-level throttling.
 * Abuse detection is monitoring-only and never blocks sends.
 */
export async function sendOne(
  orgId: string,
  assignmentId: string,
  agentUserId: string,
  body: string,
  mediaUrl?: string,
  sendLatencyMs?: number
) {
  // M-14: Validate message length before proceeding
  const MAX_MESSAGE_LENGTH = 1600; // Twilio max
  if (!body || body.trim().length === 0) {
    throw new Error("Message body cannot be empty");
  }
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long (${body.length} chars). Maximum is ${MAX_MESSAGE_LENGTH}.`);
  }

  // 0. Check if agent is flagged for suspicious send rate
  const flagged = await connection.get(`p2p:agent:${agentUserId}:flagged`);
  if (flagged) {
    throw new Error("Send rate flagged for review. Please contact your supervisor.");
  }

  // 1. Verify assignment belongs to this agent and is PENDING
  const assignment = await db.p2PAssignment.findFirst({
    where: { id: assignmentId, assignedToId: agentUserId, orgId },
    include: { contact: true, campaign: { include: { org: true } } },
  });
  if (!assignment) throw new Error("Assignment not found or not yours");
  if (assignment.status !== "PENDING") throw new Error("Assignment already processed");

  // H-19: Verify contact belongs to the same org
  if (assignment.contact.orgId !== orgId) {
    throw new Error("Contact does not belong to this organization");
  }

  // 2. Verify contact is still opted in
  if (assignment.contact.optInStatus !== "OPTED_IN") {
    // Auto-skip opted-out contacts
    await db.p2PAssignment.update({
      where: { id: assignmentId },
      data: { status: "OPTED_OUT", skippedAt: new Date() },
    });
    return { skipped: true, reason: "Contact is not opted in" };
  }

  // 3. Pre-send compliance checks (quiet hours, political disclaimer, etc.)
  const complianceResult = await runComplianceChecks(
    orgId,
    assignment.contactId,
    body,
    assignment.contact.phone
  );
  if (!complianceResult.allowed) {
    return {
      sent: false,
      blocked: true,
      reason: complianceResult.reason || "Compliance check failed",
      action: complianceResult.action,
      delayUntil: complianceResult.delayUntil,
    };
  }

  const message = await db.message.create({
    data: {
      orgId,
      campaignId: assignment.campaignId,
      contactId: assignment.contactId,
      direction: "OUTBOUND",
      body,
      mediaUrl: mediaUrl || assignment.campaign.mediaUrl || undefined,
      status: "QUEUED",
    },
  });

  // 4. Queue the message for sending (priority 1 = highest, same as inbox replies)
  await messageQueue.add(
    "send",
    {
      messageId: message.id,
      orgId,
      contactId: assignment.contactId,
      body,
      mediaUrl: mediaUrl || assignment.campaign.mediaUrl || undefined,
      campaignId: assignment.campaignId,
    },
    { priority: 1 }
  );

  // 5. Update assignment
  const messageModified = body !== (assignment.campaign.p2pScript || assignment.campaign.messageBody);
  await db.p2PAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      customBody: messageModified ? body : null,
    },
  });

  // 6. Increment campaign sent count
  await db.campaign.update({
    where: { id: assignment.campaignId },
    data: { sentCount: { increment: 1 } },
  });

  // 7. Create/upsert conversation
  await db.conversation.upsert({
    where: {
      orgId_contactId: { orgId, contactId: assignment.contactId },
    },
    create: {
      orgId,
      contactId: assignment.contactId,
      state: "OPEN",
      lastMessageAt: new Date(),
    },
    update: {
      lastMessageAt: new Date(),
      state: "OPEN",
    },
  });

  // 8. Audit log
  await db.consentAuditLog.create({
    data: {
      orgId,
      contactId: assignment.contactId,
      action: "p2p_message_sent",
      source: "p2p_agent",
      metadata: {
        agentUserId,
        campaignId: assignment.campaignId,
        assignmentId,
        messageModified,
        sendLatencyMs: sendLatencyMs ?? null,
        clickTimestamp: new Date().toISOString(),
      },
    },
  });

  // 9. Abuse detection — monitoring only, never blocks sends
  const now = Date.now();
  const redisKey = `p2p:agent:${agentUserId}:sends`;
  await connection.zadd(redisKey, now, `${assignmentId}:${now}`);
  await connection.expire(redisKey, 3600);

  // Check for suspicious patterns in a 30-second window
  const windowStart = now - 30000;
  const recentSends = await connection.zrangebyscore(redisKey, windowStart, now);
  if (recentSends.length >= 2) {
    const timestamps = recentSends.map((entry: string) => parseInt(entry.split(":").pop()!));
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avgInterval < P2P_SUSPICIOUS_MIN_INTERVAL_MS) {
      console.warn(
        `P2P_SUSPICIOUS_RATE: Agent ${agentUserId} averaging ${Math.round(avgInterval)}ms between sends (threshold: ${P2P_SUSPICIOUS_MIN_INTERVAL_MS}ms)`
      );
      // Set flag for supervisor dashboard to read
      await connection.set(`p2p:agent:${agentUserId}:flagged`, "1", "EX", 3600);
    }
  }

  return { sent: true, messageId: message.id };
}

/**
 * Skip a contact in the P2P queue.
 */
export async function skipOne(
  orgId: string,
  assignmentId: string,
  agentUserId: string,
  reason?: string
) {
  const assignment = await db.p2PAssignment.findFirst({
    where: { id: assignmentId, assignedToId: agentUserId, orgId, status: "PENDING" },
  });
  if (!assignment) throw new Error("Assignment not found or already processed");

  await db.p2PAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "SKIPPED",
      skippedAt: new Date(),
      skippedReason: reason || null,
    },
  });

  return { skipped: true };
}

/**
 * Get progress stats for a specific agent on a campaign.
 */
export async function getAgentProgress(
  orgId: string,
  campaignId: string,
  agentUserId: string
) {
  const counts = await db.p2PAssignment.groupBy({
    by: ["status"],
    where: { campaignId, assignedToId: agentUserId, orgId },
    _count: true,
  });

  const byStatus: Record<string, number> = {};
  counts.forEach((c) => {
    byStatus[c.status] = c._count;
  });

  return {
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    sent: byStatus["SENT"] || 0,
    skipped: byStatus["SKIPPED"] || 0,
    pending: byStatus["PENDING"] || 0,
    replied: byStatus["REPLIED"] || 0,
    optedOut: byStatus["OPTED_OUT"] || 0,
  };
}

/**
 * Get overall campaign P2P stats with per-agent breakdown.
 */
export async function getCampaignP2PStats(orgId: string, campaignId: string) {
  const agents = await db.p2PAssignment.groupBy({
    by: ["assignedToId", "status"],
    where: { campaignId, orgId },
    _count: true,
  });

  // Group by agent
  const agentMap: Record<string, Record<string, number>> = {};
  agents.forEach((row) => {
    if (!agentMap[row.assignedToId]) agentMap[row.assignedToId] = {};
    agentMap[row.assignedToId][row.status] = row._count;
  });

  // Get agent names
  const agentIds = Object.keys(agentMap);
  const users = await db.user.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true, role: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const agentStats = agentIds.map((agentId) => {
    const stats = agentMap[agentId];
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return {
      agentId,
      agentName: userMap[agentId]?.name || "Unknown",
      agentRole: userMap[agentId]?.role || "SENDER",
      total,
      sent: stats["SENT"] || 0,
      skipped: stats["SKIPPED"] || 0,
      pending: stats["PENDING"] || 0,
      replied: stats["REPLIED"] || 0,
    };
  });

  const totals = agentStats.reduce(
    (acc, a) => ({
      total: acc.total + a.total,
      sent: acc.sent + a.sent,
      skipped: acc.skipped + a.skipped,
      pending: acc.pending + a.pending,
      replied: acc.replied + a.replied,
    }),
    { total: 0, sent: 0, skipped: 0, pending: 0, replied: 0 }
  );

  return { agents: agentStats, totals };
}

/**
 * Get prior message history between the org and a contact.
 */
export async function getContactHistory(orgId: string, contactId: string) {
  return db.message.findMany({
    where: { orgId, contactId },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      direction: true,
      body: true,
      mediaUrl: true,
      status: true,
      createdAt: true,
      campaign: { select: { name: true } },
    },
  });
}
