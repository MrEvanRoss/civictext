"use server";

import { requireAuth, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import {
  assignContactsToAgents,
  getNextBatch,
  sendOne,
  skipOne,
  getAgentProgress,
  getCampaignP2PStats,
  getContactHistory,
} from "@/server/services/p2p-service";

/**
 * Assign contacts to agents for a P2P campaign.
 * Requires CAMPAIGN_CREATE permission (Manager+).
 */
export async function assignP2PContactsAction(
  campaignId: string,
  agentIds: string[],
  contactsPerAgent?: number
) {
  const session = await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const user = session.user as any;
  return assignContactsToAgents(user.orgId, campaignId, agentIds, contactsPerAgent);
}

/**
 * Get the next batch of contacts for the current agent.
 * Requires P2P_SEND permission.
 */
export async function getNextP2PBatchAction(campaignId: string, batchSize: number = 1) {
  const session = await requirePermission(PERMISSIONS.P2P_SEND);
  const user = session.user as any;
  return getNextBatch(user.orgId, campaignId, user.id, batchSize);
}

/**
 * Send a single P2P message. Each call = one human-initiated send.
 * Requires P2P_SEND permission.
 */
export async function sendP2PMessageAction(
  assignmentId: string,
  body: string,
  mediaUrl?: string,
  sessionStartTime?: number
) {
  const session = await requirePermission(PERMISSIONS.P2P_SEND);
  const user = session.user as any;
  return sendOne(user.orgId, assignmentId, user.id, body, mediaUrl, sessionStartTime);
}

/**
 * Skip a P2P assignment. Requires P2P_SEND permission.
 */
export async function skipP2PAssignmentAction(assignmentId: string, reason?: string) {
  const session = await requirePermission(PERMISSIONS.P2P_SEND);
  const user = session.user as any;
  return skipOne(user.orgId, assignmentId, user.id, reason);
}

/**
 * Get the current agent's progress on a P2P campaign.
 */
export async function getP2PAgentProgressAction(campaignId: string) {
  const session = await requirePermission(PERMISSIONS.P2P_SEND);
  const user = session.user as any;
  return getAgentProgress(user.orgId, campaignId, user.id);
}

/**
 * Get overall P2P campaign stats with per-agent breakdown.
 * Requires ANALYTICS_VIEW permission.
 */
export async function getP2PCampaignStatsAction(campaignId: string) {
  const session = await requirePermission(PERMISSIONS.ANALYTICS_VIEW);
  const user = session.user as any;
  return getCampaignP2PStats(user.orgId, campaignId);
}

/**
 * Get prior message history for a contact (for P2P context panel).
 */
export async function getContactHistoryAction(contactId: string) {
  const session = await requirePermission(PERMISSIONS.P2P_SEND);
  const user = session.user as any;
  return getContactHistory(user.orgId, contactId);
}
