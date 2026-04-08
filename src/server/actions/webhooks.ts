"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import crypto from "crypto";

const VALID_EVENTS = [
  "message.sent",
  "message.delivered",
  "message.failed",
  "message.inbound",
  "contact.opted_in",
  "contact.opted_out",
  "campaign.completed",
  "interest_list.joined",
];

export async function listWebhooksAction() {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  return db.webhookEndpoint.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createWebhookAction(input: {
  url: string;
  events: string[];
}) {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  if (!input.url.startsWith("https://")) {
    throw new Error("Webhook URL must use HTTPS");
  }

  const invalidEvents = input.events.filter((e) => !VALID_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    throw new Error(`Invalid events: ${invalidEvents.join(", ")}`);
  }

  const secret = crypto.randomBytes(32).toString("hex");

  return db.webhookEndpoint.create({
    data: {
      orgId,
      url: input.url,
      events: input.events,
      secret,
    },
  });
}

export async function deleteWebhookAction(webhookId: string) {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  await db.webhookEndpoint.deleteMany({
    where: { id: webhookId, orgId },
  });
}

export async function toggleWebhookAction(webhookId: string) {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id: webhookId, orgId },
  });
  if (!endpoint) throw new Error("Webhook not found");

  return db.webhookEndpoint.update({
    where: { id: webhookId },
    data: { isActive: !endpoint.isActive, failCount: 0, lastError: null },
  });
}

export async function getAvailableEvents() {
  return VALID_EVENTS;
}
