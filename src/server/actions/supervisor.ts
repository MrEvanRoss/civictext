"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";

/**
 * Get supervisor overview: escalated conversations, agent workload, queue stats.
 */
export async function getSupervisorDashboardAction() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    escalatedCount,
    openCount,
    unassignedCount,
    totalAgents,
    agentStats,
    escalatedConversations,
    todayMessages,
    weekMessages,
    todayOptOuts,
  ] = await Promise.all([
    // Escalated conversations
    db.conversation.count({ where: { orgId, isEscalated: true } }),
    // Open conversations
    db.conversation.count({ where: { orgId, state: "OPEN" } }),
    // Unassigned conversations
    db.conversation.count({ where: { orgId, state: "OPEN", assignedToId: null } }),
    // Total agents
    db.user.count({ where: { orgId, role: { in: ["SENDER", "MANAGER", "ADMIN", "OWNER"] } } }),
    // Per-agent stats
    db.user.findMany({
      where: { orgId, role: { in: ["SENDER", "MANAGER", "ADMIN", "OWNER"] } },
      select: {
        id: true,
        name: true,
        role: true,
        lastLoginAt: true,
        assignedConversations: {
          where: { state: "OPEN" },
          select: { id: true },
        },
        conversationNotes: {
          where: { createdAt: { gte: today } },
          select: { id: true },
        },
      },
    }),
    // Escalated conversation list
    db.conversation.findMany({
      where: { orgId, isEscalated: true },
      orderBy: { escalatedAt: "desc" },
      take: 20,
      include: {
        contact: { select: { phone: true, firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    // Today's outbound message count
    db.message.count({
      where: { orgId, direction: "OUTBOUND", createdAt: { gte: today } },
    }),
    // Week's messages
    db.message.count({
      where: { orgId, direction: "OUTBOUND", createdAt: { gte: weekAgo } },
    }),
    // Today's opt-outs
    db.consentAuditLog.count({
      where: { orgId, action: "OPTED_OUT", createdAt: { gte: today } },
    }),
  ]);

  // Calculate per-agent metrics
  const agentMetrics = agentStats.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    lastLoginAt: agent.lastLoginAt,
    openConversations: agent.assignedConversations.length,
    todayNotes: agent.conversationNotes.length,
    isOnline: agent.lastLoginAt
      ? new Date().getTime() - new Date(agent.lastLoginAt).getTime() < 30 * 60 * 1000
      : false,
  }));

  // Sort by open conversations (busiest first) for leaderboard
  agentMetrics.sort((a, b) => b.openConversations - a.openConversations);

  return {
    escalatedCount,
    openCount,
    unassignedCount,
    totalAgents,
    agentMetrics,
    escalatedConversations,
    todayMessages,
    weekMessages,
    todayOptOuts,
  };
}
