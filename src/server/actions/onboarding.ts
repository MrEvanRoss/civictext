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
  const orgId = (session.user as any).orgId;

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
  const orgId = (session.user as any).orgId;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    messagesSent,
    messagesDelivered,
    activeContacts,
    activeCampaigns,
    recentCampaigns,
    plan,
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
  ]);

  const deliveryRate =
    messagesSent > 0 ? ((messagesDelivered / messagesSent) * 100).toFixed(1) : null;

  return {
    messagesSent,
    deliveryRate,
    activeContacts,
    activeCampaigns,
    recentCampaigns,
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
