"use server";

import { requireOrg } from "./auth";
import { db } from "@/lib/db";

export interface OnboardingStatus {
  twilioSetup: boolean;
  brandRegistered: boolean;
  phoneNumber: boolean;
  contactsImported: boolean;
  firstCampaign: boolean;
  completedSteps: number;
  totalSteps: number;
}

export async function getOnboardingStatusAction(): Promise<OnboardingStatus> {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const [subaccount, brand, phoneNumber, contactCount, campaignCount] =
    await Promise.all([
      db.twilioSubaccount.findUnique({ where: { orgId } }),
      db.brandRegistration.findFirst({
        where: { orgId },
        orderBy: { createdAt: "desc" },
      }),
      db.phoneNumber.findFirst({ where: { orgId, status: "ACTIVE" } }),
      db.contact.count({ where: { orgId } }),
      db.campaign.count({ where: { orgId } }),
    ]);

  const steps = {
    twilioSetup: !!subaccount,
    brandRegistered: !!brand && brand.status === "APPROVED",
    phoneNumber: !!phoneNumber,
    contactsImported: contactCount > 0,
    firstCampaign: campaignCount > 0,
  };

  const completedSteps = Object.values(steps).filter(Boolean).length;

  return {
    ...steps,
    completedSteps,
    totalSteps: 5,
  };
}

export async function getDashboardStatsAction() {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Start of today (midnight in UTC — sufficient for dashboard counts)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 7 days from now for scheduled campaigns
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const [
    messagesSent,
    messagesDelivered,
    activeContacts,
    activeCampaigns,
    recentCampaigns,
    plan,
    // New queries for extended dashboard
    messagesToday,
    responsesToday,
    pendingConversations,
    scheduledCampaigns,
    recentCompletedCampaigns,
    recentOptIns,
  ] = await Promise.all([
    db.message.count({
      where: { orgId, direction: "OUTBOUND", createdAt: { gte: thirtyDaysAgo } },
    }),
    db.message.count({
      where: { orgId, direction: "OUTBOUND", status: "DELIVERED", createdAt: { gte: thirtyDaysAgo } },
    }),
    db.contact.count({
      where: { orgId, optInStatus: "OPTED_IN" },
    }),
    db.campaign.count({
      where: { orgId, status: { in: ["SENDING", "SCHEDULED"] } },
    }),
    db.campaign.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        sentCount: true,
        deliveredCount: true,
        createdAt: true,
      },
    }),
    db.messagingPlan.findUnique({ where: { orgId } }),
    // Messages sent today (outbound)
    db.message.count({
      where: { orgId, direction: "OUTBOUND", createdAt: { gte: todayStart } },
    }),
    // Responses received today (inbound)
    db.message.count({
      where: { orgId, direction: "INBOUND", createdAt: { gte: todayStart } },
    }),
    // Open/pending conversations
    db.conversation.count({
      where: { orgId, state: { in: ["OPEN", "PENDING"] } },
    }),
    // Scheduled campaigns in the next 7 days
    db.campaign.findMany({
      where: {
        orgId,
        status: "SCHEDULED",
        scheduledAt: { gte: new Date(), lte: sevenDaysFromNow },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
      select: {
        id: true,
        name: true,
        scheduledAt: true,
        type: true,
        segmentId: true,
        totalRecipients: true,
      },
    }),
    // Recently completed campaigns (for activity feed)
    db.campaign.findMany({
      where: {
        orgId,
        status: "COMPLETED",
        completedAt: { not: null },
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        sentCount: true,
        completedAt: true,
      },
    }),
    // Recently opted-in contacts (for activity feed)
    db.contact.findMany({
      where: {
        orgId,
        optInStatus: "OPTED_IN",
        optInTimestamp: { not: null },
      },
      orderBy: { optInTimestamp: "desc" },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        optInTimestamp: true,
      },
    }),
  ]);

  const deliveryRate =
    messagesSent > 0 ? ((messagesDelivered / messagesSent) * 100).toFixed(1) : null;

  // Build recent activity feed from completed campaigns + opted-in contacts
  type ActivityItem = {
    type: "campaign_sent" | "contact_joined";
    description: string;
    timestamp: Date;
    linkTo?: string;
  };

  const activityItems: ActivityItem[] = [];

  for (const c of recentCompletedCampaigns) {
    if (c.completedAt) {
      activityItems.push({
        type: "campaign_sent",
        description: `Campaign '${c.name}' sent to ${c.sentCount.toLocaleString()} recipients`,
        timestamp: c.completedAt,
        linkTo: `/campaigns/${c.id}`,
      });
    }
  }

  for (const contact of recentOptIns) {
    if (contact.optInTimestamp) {
      const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "A contact";
      activityItems.push({
        type: "contact_joined",
        description: `${name} joined`,
        timestamp: contact.optInTimestamp,
        linkTo: `/contacts/${contact.id}`,
      });
    }
  }

  // Sort by timestamp descending, take 10
  activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentActivity = activityItems.slice(0, 10);

  return {
    messagesSent,
    messagesToday,
    responsesToday,
    deliveryRate,
    activeContacts,
    activeCampaigns,
    pendingConversations,
    recentCampaigns,
    scheduledCampaigns,
    recentActivity,
    plan: plan
      ? {
          balanceCents: plan.balanceCents,
          balanceDollars: (plan.balanceCents / 100).toFixed(2),
          smsRateCents: plan.smsRateCents,
          mmsRateCents: plan.mmsRateCents,
        }
      : null,
  };
}
