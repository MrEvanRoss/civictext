"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import type { ContentFilterAction } from "@prisma/client";

// ---------------------------------------------------------------------------
// List all content filters for the current org
// ---------------------------------------------------------------------------
export async function listContentFiltersAction() {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  return db.contentFilter.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Create a single content filter
// ---------------------------------------------------------------------------
export async function createContentFilterAction(
  phrase: string,
  action: ContentFilterAction
) {
  await requirePermission(PERMISSIONS.ORG_SETTINGS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const trimmed = phrase.trim().toLowerCase();
  if (!trimmed) throw new Error("Phrase is required");

  // Check for duplicate
  const existing = await db.contentFilter.findUnique({
    where: { orgId_phrase: { orgId, phrase: trimmed } },
  });
  if (existing) throw new Error(`Filter for "${trimmed}" already exists`);

  return db.contentFilter.create({
    data: {
      orgId,
      phrase: trimmed,
      action,
    },
  });
}

// ---------------------------------------------------------------------------
// Update an existing content filter
// ---------------------------------------------------------------------------
export async function updateContentFilterAction(
  id: string,
  data: {
    phrase?: string;
    action?: ContentFilterAction;
    isActive?: boolean;
  }
) {
  await requirePermission(PERMISSIONS.ORG_SETTINGS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const filter = await db.contentFilter.findFirst({
    where: { id, orgId },
  });
  if (!filter) throw new Error("Content filter not found");

  const updateData: any = {};

  if (data.phrase !== undefined) {
    const trimmed = data.phrase.trim().toLowerCase();
    if (!trimmed) throw new Error("Phrase is required");
    // Check uniqueness if phrase is changing
    if (trimmed !== filter.phrase) {
      const existing = await db.contentFilter.findUnique({
        where: { orgId_phrase: { orgId, phrase: trimmed } },
      });
      if (existing) throw new Error(`Filter for "${trimmed}" already exists`);
    }
    updateData.phrase = trimmed;
  }
  if (data.action !== undefined) updateData.action = data.action;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return db.contentFilter.update({
    where: { id },
    data: updateData,
  });
}

// ---------------------------------------------------------------------------
// Delete a content filter
// ---------------------------------------------------------------------------
export async function deleteContentFilterAction(id: string) {
  await requirePermission(PERMISSIONS.ORG_SETTINGS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  await db.contentFilter.deleteMany({
    where: { id, orgId },
  });
}

// ---------------------------------------------------------------------------
// Toggle isActive on a content filter
// ---------------------------------------------------------------------------
export async function toggleContentFilterAction(id: string) {
  await requirePermission(PERMISSIONS.ORG_SETTINGS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const filter = await db.contentFilter.findFirst({
    where: { id, orgId },
  });
  if (!filter) throw new Error("Content filter not found");

  return db.contentFilter.update({
    where: { id },
    data: { isActive: !filter.isActive },
  });
}

// ---------------------------------------------------------------------------
// Bulk import multiple phrases at once
// ---------------------------------------------------------------------------
export async function bulkImportContentFiltersAction(
  phrases: string[],
  action: ContentFilterAction
) {
  await requirePermission(PERMISSIONS.ORG_SETTINGS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  // Normalize and deduplicate
  const unique = Array.from(
    new Set(
      phrases
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (unique.length === 0) throw new Error("No valid phrases provided");

  // Find existing phrases to skip
  const existing = await db.contentFilter.findMany({
    where: { orgId, phrase: { in: unique } },
    select: { phrase: true },
  });
  const existingSet = new Set(existing.map((e) => e.phrase));

  const toCreate = unique.filter((p) => !existingSet.has(p));

  if (toCreate.length === 0) {
    return { created: 0, skipped: unique.length };
  }

  await db.contentFilter.createMany({
    data: toCreate.map((phrase) => ({
      orgId,
      phrase,
      action,
    })),
  });

  return { created: toCreate.length, skipped: existingSet.size };
}

// ---------------------------------------------------------------------------
// Check a message body against all active filters for an org
// Returns the first matching filter or null
// ---------------------------------------------------------------------------
export async function checkMessageAgainstFiltersAction(
  orgId: string,
  messageBody: string
) {
  const filters = await db.contentFilter.findMany({
    where: { orgId, isActive: true },
  });

  const bodyLower = messageBody.toLowerCase();

  for (const filter of filters) {
    if (bodyLower.includes(filter.phrase)) {
      return filter;
    }
  }

  return null;
}
