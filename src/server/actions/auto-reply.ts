"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } from "@/lib/constants";

export async function listAutoReplyRulesAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  return db.autoReplyRule.findMany({
    where: { orgId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function createAutoReplyRuleAction(input: {
  name: string;
  keywords: string[];
  replyBody: string;
  mediaUrl?: string;
  priority?: number;
}) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  if (!input.name.trim()) throw new Error("Name is required");
  if (input.keywords.length === 0) throw new Error("At least one keyword is required");
  if (!input.replyBody.trim()) throw new Error("Reply body is required");

  // Normalize keywords to uppercase
  const keywords = input.keywords.map((k) => k.toUpperCase().trim()).filter(Boolean);

  // Check for reserved keywords
  const reserved = [...OPT_OUT_KEYWORDS, ...OPT_IN_KEYWORDS];
  const conflicts = keywords.filter((k) => reserved.includes(k));
  if (conflicts.length > 0) {
    throw new Error(`Keywords conflict with system keywords: ${conflicts.join(", ")}`);
  }

  // Check for conflicts with existing interest list keywords
  const listConflicts = await db.interestList.findMany({
    where: { orgId, keyword: { in: keywords } },
  });
  if (listConflicts.length > 0) {
    throw new Error(
      `Keywords already used by Interest Lists: ${listConflicts.map((l) => l.keyword).join(", ")}`
    );
  }

  return db.autoReplyRule.create({
    data: {
      orgId,
      name: input.name.trim(),
      keywords,
      replyBody: input.replyBody.trim(),
      mediaUrl: input.mediaUrl || null,
      priority: input.priority || 0,
    },
  });
}

export async function updateAutoReplyRuleAction(
  ruleId: string,
  input: {
    name?: string;
    keywords?: string[];
    replyBody?: string;
    mediaUrl?: string;
    priority?: number;
    isActive?: boolean;
  }
) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const rule = await db.autoReplyRule.findFirst({
    where: { id: ruleId, orgId },
  });
  if (!rule) throw new Error("Rule not found");

  const data: any = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.replyBody !== undefined) data.replyBody = input.replyBody.trim();
  if (input.mediaUrl !== undefined) data.mediaUrl = input.mediaUrl || null;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  if (input.keywords !== undefined) {
    const keywords = input.keywords.map((k) => k.toUpperCase().trim()).filter(Boolean);
    const reserved = [...OPT_OUT_KEYWORDS, ...OPT_IN_KEYWORDS];
    const conflicts = keywords.filter((k) => reserved.includes(k));
    if (conflicts.length > 0) {
      throw new Error(`Keywords conflict with system keywords: ${conflicts.join(", ")}`);
    }
    data.keywords = keywords;
  }

  return db.autoReplyRule.update({
    where: { id: ruleId },
    data,
  });
}

export async function deleteAutoReplyRuleAction(ruleId: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  await db.autoReplyRule.deleteMany({
    where: { id: ruleId, orgId },
  });
}
