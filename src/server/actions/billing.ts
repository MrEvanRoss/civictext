"use server";

import { requireOrg, requirePermission } from "./auth";
import { getCurrentBalance } from "@/server/services/quota-service";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/constants";

export async function getBillingOverviewAction() {
  await requirePermission(PERMISSIONS.BILLING_VIEW);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const [plan, balance, addOns, activePhoneNumbers] = await Promise.all([
    db.messagingPlan.findUnique({ where: { orgId } }),
    getCurrentBalance(orgId),
    db.addOnPurchase.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.phoneNumber.count({ where: { orgId, status: "ACTIVE" } }),
  ]);

  const phoneFeeCents = plan?.phoneNumberFeeCents || 500;
  const monthlyPhoneCostCents = activePhoneNumbers * phoneFeeCents;

  return {
    plan,
    balance,
    addOns,
    activePhoneNumbers,
    monthlyPhoneCostCents,
  };
}

export async function getUsageLedgerAction(opts?: { page?: number }) {
  await requirePermission(PERMISSIONS.BILLING_VIEW);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
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
