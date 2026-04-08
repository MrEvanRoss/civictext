"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";

export async function listTemplatesAction(opts?: {
  category?: string;
  search?: string;
}) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const where: any = { orgId, isArchived: false };
  if (opts?.category && opts.category !== "all") {
    where.category = opts.category;
  }
  if (opts?.search) {
    where.OR = [
      { name: { contains: opts.search, mode: "insensitive" } },
      { body: { contains: opts.search, mode: "insensitive" } },
    ];
  }

  return db.messageTemplate.findMany({
    where,
    orderBy: [{ usageCount: "desc" }, { updatedAt: "desc" }],
    include: {
      createdBy: { select: { name: true } },
    },
  });
}

export async function createTemplateAction(input: {
  name: string;
  body: string;
  category?: string;
  mediaUrl?: string;
  language?: string;
  tags?: string[];
}) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const userId = (session.user as any).id;

  return db.messageTemplate.create({
    data: {
      orgId,
      name: input.name.trim(),
      body: input.body,
      category: input.category || "general",
      mediaUrl: input.mediaUrl || null,
      language: input.language || "en",
      tags: input.tags || [],
      createdById: userId,
    },
  });
}

export async function updateTemplateAction(
  templateId: string,
  input: {
    name?: string;
    body?: string;
    category?: string;
    mediaUrl?: string;
    language?: string;
    tags?: string[];
  }
) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const existing = await db.messageTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!existing) throw new Error("Template not found");

  return db.messageTemplate.update({
    where: { id: templateId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.mediaUrl !== undefined && { mediaUrl: input.mediaUrl || null }),
      ...(input.language !== undefined && { language: input.language }),
      ...(input.tags !== undefined && { tags: input.tags }),
    },
  });
}

export async function deleteTemplateAction(templateId: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  await db.messageTemplate.deleteMany({
    where: { id: templateId, orgId },
  });
}

export async function useTemplateAction(templateId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const template = await db.messageTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!template) throw new Error("Template not found");

  // Increment usage count
  await db.messageTemplate.update({
    where: { id: templateId },
    data: { usageCount: { increment: 1 } },
  });

  return template;
}
