"use server";

import { requireOrg } from "./auth";
import { getCurrentBalance } from "@/server/services/quota-service";
import { db } from "@/lib/db";

export async function getBillingOverviewAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const [plan, balance, addOns] = await Promise.all([
    db.messagingPlan.findUnique({ where: { orgId } }),
    getCurrentBalance(orgId),
    db.addOnPurchase.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    plan,
    balance,
    addOns,
  };
}

export async function getUsageLedgerAction(opts?: { page?: number }) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const page = opts?.page || 1;
  const pageSize = 50;

  const [entries, total] = await Promise.all([
    db.usageLedger.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        campaign: { select: { name: true } },
      },
    }),
    db.usageLedger.count({ where: { orgId } }),
  ]);

  return { entries, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
