"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import crypto from "crypto";

const API_KEY_PERMISSIONS = [
  "contacts:read",
  "contacts:write",
  "messages:send",
  "messages:read",
  "campaigns:read",
  "campaigns:write",
  "lists:read",
  "lists:write",
];

export async function getAvailablePermissions() {
  return API_KEY_PERMISSIONS;
}

export async function listApiKeysAction() {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  return db.apiKey.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createApiKeyAction(input: {
  name: string;
  permissions: string[];
  expiresAt?: string;
}) {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  const userId = session.user.id;

  if (!input.name.trim()) throw new Error("Name is required");
  if (input.permissions.length === 0) throw new Error("Select at least one permission");

  const invalidPerms = input.permissions.filter((p) => !API_KEY_PERMISSIONS.includes(p));
  if (invalidPerms.length > 0) throw new Error(`Invalid permissions: ${invalidPerms.join(", ")}`);

  // Generate a secure API key: ct_live_ + 32 random bytes as hex
  const rawKey = `ct_live_${crypto.randomBytes(32).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 16); // "ct_live_" + first 8 hex chars

  await db.apiKey.create({
    data: {
      orgId,
      name: input.name.trim(),
      keyHash,
      keyPrefix,
      permissions: input.permissions,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdById: userId,
    },
  });

  // Return the raw key once — it will never be shown again
  return { key: rawKey, prefix: keyPrefix };
}

export async function revokeApiKeyAction(apiKeyId: string) {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  await db.apiKey.updateMany({
    where: { id: apiKeyId, orgId },
    data: { isActive: false },
  });
}

export async function deleteApiKeyAction(apiKeyId: string) {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  await db.apiKey.deleteMany({
    where: { id: apiKeyId, orgId },
  });
}
