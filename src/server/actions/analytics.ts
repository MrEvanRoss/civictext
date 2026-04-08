"use server";

import { requireOrg } from "./auth";
import { db } from "@/lib/db";

export async function getDashboardAnalyticsAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalMessages,
    deliveredMessages,
    failedMessages,
    totalContacts,
    optedOutContacts,
    activeCampaigns,
    ,
    topCampaigns,
  ] = await Promise.all([
    db.message.count({
      where: { orgId, direction: "OUTBOUND", createdAt: { gte: thirtyDaysAgo } },
    }),
    db.message.count({
      where: { orgId, direction: "OUTBOUND", status: "DELIVERED", createdAt: { gte: thirtyDaysAgo } },
    }),
    db.message.count({
      where: {
        orgId,
        direction: "OUTBOUND",
        status: { in: ["FAILED", "UNDELIVERED"] },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.contact.count({ where: { orgId, optInStatus: "OPTED_IN" } }),
    db.contact.count({
      where: { orgId, optInStatus: "OPTED_OUT", optOutTimestamp: { gte: thirtyDaysAgo } },
    }),
    db.campaign.count({
      where: { orgId, status: { in: ["SENDING", "SCHEDULED"] } },
    }),
    // Recent 7-day daily send counts
    db.message.groupBy({
      by: ["createdAt"],
      where: {
        orgId,
        direction: "OUTBOUND",
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
    }),
    // Top campaigns by engagement
    db.campaign.findMany({
      where: {
        orgId,
        status: { in: ["COMPLETED", "SENDING"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { deliveredCount: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        sentCount: true,
        deliveredCount: true,
        responseCount: true,
        optOutCount: true,
      },
    }),
  ]);

  const deliveryRate =
    totalMessages > 0
      ? ((deliveredMessages / totalMessages) * 100).toFixed(1)
      : "0";

  return {
    totalMessages,
    deliveredMessages,
    failedMessages,
    deliveryRate,
    totalContacts,
    optedOutContacts,
    activeCampaigns,
    topCampaigns,
  };
}
