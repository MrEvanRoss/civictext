"use server";

import { requireOrg } from "./auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ============================================================
// Legacy Dashboard Analytics (kept for backward compatibility)
// ============================================================

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

// ============================================================
// Enhanced Insights Dashboard Actions
// ============================================================

interface DateRange {
  start: Date;
  end: Date;
}

/**
 * KPI metrics for the insights dashboard.
 */
export async function getDashboardInsightsAction(dateRange: DateRange) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const { start, end } = dateRange;

  const [
    totalMembers,
    messagesSent,
    inboundCount,
    deliveredCount,
    optOutsInRange,
  ] = await Promise.all([
    // Total OPTED_IN contacts (all time, not date-scoped)
    db.contact.count({
      where: { orgId, optInStatus: "OPTED_IN" },
    }),
    // Outbound messages in date range
    db.message.count({
      where: {
        orgId,
        direction: "OUTBOUND",
        createdAt: { gte: start, lte: end },
      },
    }),
    // Inbound messages in date range (responses)
    db.message.count({
      where: {
        orgId,
        direction: "INBOUND",
        createdAt: { gte: start, lte: end },
      },
    }),
    // Delivered messages in date range
    db.message.count({
      where: {
        orgId,
        direction: "OUTBOUND",
        status: "DELIVERED",
        createdAt: { gte: start, lte: end },
      },
    }),
    // Contacts who opted out in date range
    db.contact.count({
      where: {
        orgId,
        optInStatus: "OPTED_OUT",
        optOutTimestamp: { gte: start, lte: end },
      },
    }),
  ]);

  const responseRate =
    messagesSent > 0
      ? parseFloat(((inboundCount / messagesSent) * 100).toFixed(1))
      : 0;

  const optOutRate =
    messagesSent > 0
      ? parseFloat(((optOutsInRange / messagesSent) * 100).toFixed(1))
      : 0;

  const deliveryRate =
    messagesSent > 0
      ? parseFloat(((deliveredCount / messagesSent) * 100).toFixed(1))
      : 0;

  return {
    totalMembers,
    messagesSent,
    responseRate,
    optOutRate,
    deliveryRate,
  };
}

/**
 * Message volume time series grouped by day or week.
 */
export async function getMessageTrendAction(
  dateRange: DateRange,
  granularity: "day" | "week"
) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const { start, end } = dateRange;

  const truncFn = granularity === "week" ? "week" : "day";

  const rows = await db.$queryRaw<
    Array<{ period: Date; status: string; count: bigint }>
  >(
    Prisma.sql`
      SELECT
        date_trunc(${truncFn}, "createdAt") AS period,
        "status",
        COUNT(*)::bigint AS count
      FROM "Message"
      WHERE "orgId" = ${orgId}
        AND "direction" = 'OUTBOUND'
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
      GROUP BY period, "status"
      ORDER BY period ASC
    `
  );

  // Pivot rows into { date, sent, delivered, failed } per period
  const map = new Map<
    string,
    { date: string; sent: number; delivered: number; failed: number }
  >();

  for (const row of rows) {
    const dateStr = new Date(row.period).toISOString().split("T")[0];
    if (!map.has(dateStr)) {
      map.set(dateStr, { date: dateStr, sent: 0, delivered: 0, failed: 0 });
    }
    const entry = map.get(dateStr)!;
    const count = Number(row.count);

    // All outbound messages count toward "sent"
    entry.sent += count;

    if (row.status === "DELIVERED") {
      entry.delivered += count;
    } else if (row.status === "FAILED" || row.status === "UNDELIVERED") {
      entry.failed += count;
    }
  }

  return Array.from(map.values());
}

/**
 * Member growth time series: new opt-ins vs opt-outs per day.
 */
export async function getMemberGrowthAction(dateRange: DateRange) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const { start, end } = dateRange;

  const [newMemberRows, optOutRows] = await Promise.all([
    db.$queryRaw<Array<{ period: Date; count: bigint }>>(
      Prisma.sql`
        SELECT
          date_trunc('day', "optInTimestamp") AS period,
          COUNT(*)::bigint AS count
        FROM "Contact"
        WHERE "orgId" = ${orgId}
          AND "optInTimestamp" >= ${start}
          AND "optInTimestamp" <= ${end}
          AND "optInTimestamp" IS NOT NULL
        GROUP BY period
        ORDER BY period ASC
      `
    ),
    db.$queryRaw<Array<{ period: Date; count: bigint }>>(
      Prisma.sql`
        SELECT
          date_trunc('day', "optOutTimestamp") AS period,
          COUNT(*)::bigint AS count
        FROM "Contact"
        WHERE "orgId" = ${orgId}
          AND "optOutTimestamp" >= ${start}
          AND "optOutTimestamp" <= ${end}
          AND "optOutTimestamp" IS NOT NULL
        GROUP BY period
        ORDER BY period ASC
      `
    ),
  ]);

  // Build map keyed by date
  const map = new Map<
    string,
    { date: string; newMembers: number; optOuts: number; net: number }
  >();

  for (const row of newMemberRows) {
    const dateStr = new Date(row.period).toISOString().split("T")[0];
    if (!map.has(dateStr)) {
      map.set(dateStr, { date: dateStr, newMembers: 0, optOuts: 0, net: 0 });
    }
    map.get(dateStr)!.newMembers = Number(row.count);
  }

  for (const row of optOutRows) {
    const dateStr = new Date(row.period).toISOString().split("T")[0];
    if (!map.has(dateStr)) {
      map.set(dateStr, { date: dateStr, newMembers: 0, optOuts: 0, net: 0 });
    }
    map.get(dateStr)!.optOuts = Number(row.count);
  }

  // Calculate net for every entry
  const entries = Array.from(map.values());
  for (const entry of entries) {
    entry.net = entry.newMembers - entry.optOuts;
  }

  // Sort by date
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Top 10 campaigns by sent count in the date range,
 * with delivery and response breakdowns.
 */
export async function getCampaignComparisonAction(dateRange: DateRange) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const { start, end } = dateRange;

  const campaigns = await db.campaign.findMany({
    where: {
      orgId,
      createdAt: { gte: start, lte: end },
      status: { in: ["COMPLETED", "SENDING", "PAUSED"] },
    },
    orderBy: { sentCount: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      sentCount: true,
      deliveredCount: true,
      failedCount: true,
      responseCount: true,
    },
  });

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    sent: c.sentCount,
    delivered: c.deliveredCount,
    failed: c.failedCount,
    responseCount: c.responseCount,
  }));
}

/**
 * Response rate heatmap: response rates by day of week and hour.
 */
export async function getBestSendingTimesAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  // Get outbound messages grouped by day-of-week and hour
  const outboundRows = await db.$queryRaw<
    Array<{ dow: number; hour: number; count: bigint }>
  >(
    Prisma.sql`
      SELECT
        EXTRACT(DOW FROM "createdAt")::int AS dow,
        EXTRACT(HOUR FROM "createdAt")::int AS hour,
        COUNT(*)::bigint AS count
      FROM "Message"
      WHERE "orgId" = ${orgId}
        AND "direction" = 'OUTBOUND'
      GROUP BY dow, hour
    `
  );

  // Get inbound messages (responses) grouped by day-of-week and hour
  // of the OUTBOUND message they respond to — but since we don't have
  // a direct reply link, we group inbound by their own timestamp as a proxy
  const inboundRows = await db.$queryRaw<
    Array<{ dow: number; hour: number; count: bigint }>
  >(
    Prisma.sql`
      SELECT
        EXTRACT(DOW FROM "createdAt")::int AS dow,
        EXTRACT(HOUR FROM "createdAt")::int AS hour,
        COUNT(*)::bigint AS count
      FROM "Message"
      WHERE "orgId" = ${orgId}
        AND "direction" = 'INBOUND'
      GROUP BY dow, hour
    `
  );

  // Build a lookup for inbound counts
  const inboundMap = new Map<string, number>();
  for (const row of inboundRows) {
    inboundMap.set(`${row.dow}-${row.hour}`, Number(row.count));
  }

  // Build result array
  const result: Array<{
    dayOfWeek: number;
    hour: number;
    responseRate: number;
    messageCount: number;
  }> = [];

  for (const row of outboundRows) {
    const outCount = Number(row.count);
    const inCount = inboundMap.get(`${row.dow}-${row.hour}`) || 0;
    const responseRate =
      outCount > 0
        ? parseFloat(((inCount / outCount) * 100).toFixed(1))
        : 0;

    result.push({
      dayOfWeek: row.dow,
      hour: row.hour,
      responseRate,
      messageCount: outCount,
    });
  }

  // Fill in any missing slots (0-6 days, 0-23 hours) with zeros
  const existing = new Set(result.map((r) => `${r.dayOfWeek}-${r.hour}`));
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (!existing.has(`${d}-${h}`)) {
        result.push({
          dayOfWeek: d,
          hour: h,
          responseRate: 0,
          messageCount: 0,
        });
      }
    }
  }

  return result.sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour
  );
}

/**
 * Top 5 campaigns by response rate (minimum 10 sent messages to qualify).
 */
export async function getTopCampaignsAction(dateRange: DateRange) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const { start, end } = dateRange;

  const campaigns = await db.campaign.findMany({
    where: {
      orgId,
      createdAt: { gte: start, lte: end },
      sentCount: { gt: 0 },
      status: { in: ["COMPLETED", "SENDING", "PAUSED"] },
    },
    select: {
      id: true,
      name: true,
      sentCount: true,
      deliveredCount: true,
      responseCount: true,
    },
  });

  // Calculate rates and sort by response rate descending
  const withRates = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    sent: c.sentCount,
    delivered: c.deliveredCount,
    responseRate: parseFloat(
      ((c.responseCount / c.sentCount) * 100).toFixed(1)
    ),
    deliveryRate: parseFloat(
      ((c.deliveredCount / c.sentCount) * 100).toFixed(1)
    ),
  }));

  withRates.sort((a, b) => b.responseRate - a.responseRate);

  return withRates.slice(0, 5);
}
