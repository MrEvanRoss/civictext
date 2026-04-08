import { db } from "@/lib/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { renderMergeFields } from "./campaign-service";
import { P2P_MIN_SEND_INTERVAL_MS } from "@/lib/constants";

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
  if (!campaign.segmentId) throw new Error("Campaign has no segment");
  if (agentIds.length === 0) throw new Error("At least one agent is required");

  // Get opted-in contacts from the segment
  const segment = await db.segment.findUnique({ where: { id: campaign.segmentId } });
  if (!segment) throw new Error("Segment not found");

  // Evaluate segment rules to get contacts (simplified: get all opted-in contacts)
  const contacts = await db.contact.findMany({
    where: { orgId, optInStatus: "OPTED_IN" },
    select: { id: true },
  });

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
 */
export async function sendOne(
  orgId: string,
  assignmentId: string,
  agentUserId: string,
  body: string,
  mediaUrl?: string,
  sessionStartTime?: number
) {
  // 1. Rate limit check: minimum 1 second between sends per agent
  const lastSendKey = `p2p:agent:${agentUserId}:lastSend`;
  const lastSend = await connection.get(lastSendKey);
  if (lastSend) {
    const elapsed = Date.now() - parseInt(lastSend, 10);
    if (elapsed < P2P_MIN_SEND_INTERVAL_MS) {
      // Wait the remaining time
      await new Promise((resolve) =>
        setTimeout(resolve, P2P_MIN_SEND_INTERVAL_MS - elapsed)
      );
    }
  }

  // 2. Verify assignment belongs to this agent and is PENDING
  const assignment = await db.p2PAssignment.findFirst({
    where: { id: assignmentId, assignedToId: agentUserId, orgId },
    include: { contact: true, campaign: { include: { org: true } } },
  });
  if (!assignment) throw new Error("Assignment not found or not yours");
  if (assignment.status !== "PENDING") throw new Error("Assignment already processed");

  // 3. Verify contact is still opted in
  if (assignment.contact.optInStatus !== "OPTED_IN") {
    // Auto-skip opted-out contacts
    await db.p2PAssignment.update({
      where: { id: assignmentId },
      data: { status: "OPTED_OUT", skippedAt: new Date() },
    });
    return { skipped: true, reason: "Contact is not opted in" };
  }

  // 4. Create Message record
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

  // 5. Queue the message for sending (priority 1 = highest, same as inbox replies)
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

  // 6. Update assignment
  const messageModified = body !== (assignment.campaign.p2pScript || assignment.campaign.messageBody);
  await db.p2PAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      customBody: messageModified ? body : null,
    },
  });

  // 7. Increment campaign sent count
  await db.campaign.update({
    where: { id: assignment.campaignId },
    data: { sentCount: { increment: 1 } },
  });

  // 8. Create/upsert conversation
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

  // 9. Audit log
  const sendLatency = sessionStartTime
    ? Date.now() - sessionStartTime
    : undefined;

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
        sendLatency,
      },
    },
  });

  // 10. Record agent's last send time for rate limiting
  await connection.set(lastSendKey, Date.now().toString(), "EX", 60);

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
