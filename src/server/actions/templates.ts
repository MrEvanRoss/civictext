"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  body: z.string().min(1, "Template body is required").max(1600),
  category: z.string().max(50).optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  language: z.string().max(10).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200).optional(),
  body: z.string().min(1, "Template body is required").max(1600).optional(),
  category: z.string().max(50).optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  language: z.string().max(10).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

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

  const validated = createTemplateSchema.parse(input);

  return db.messageTemplate.create({
    data: {
      orgId,
      name: validated.name.trim(),
      body: validated.body,
      category: validated.category || "general",
      mediaUrl: validated.mediaUrl || null,
      language: validated.language || "en",
      tags: validated.tags || [],
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

  z.string().uuid().parse(templateId);
  const validated = updateTemplateSchema.parse(input);

  const existing = await db.messageTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!existing) throw new Error("Template not found");

  return db.messageTemplate.update({
    where: { id: templateId },
    data: {
      ...(validated.name !== undefined && { name: validated.name.trim() }),
      ...(validated.body !== undefined && { body: validated.body }),
      ...(validated.category !== undefined && { category: validated.category }),
      ...(validated.mediaUrl !== undefined && { mediaUrl: validated.mediaUrl || null }),
      ...(validated.language !== undefined && { language: validated.language }),
      ...(validated.tags !== undefined && { tags: validated.tags }),
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
