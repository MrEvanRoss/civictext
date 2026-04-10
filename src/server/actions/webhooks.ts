"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import crypto from "crypto";
import { z } from "zod";

const VALID_EVENTS = [
  "message.sent",
  "message.delivered",
  "message.failed",
  "message.inbound",
  "contact.opted_in",
  "contact.opted_out",
  "campaign.completed",
  "interest_list.joined",
] as const;

const createWebhookSchema = z.object({
  url: z.string().url().refine((url) => url.startsWith("https://"), {
    message: "Webhook URL must use HTTPS",
  }),
  events: z.array(z.enum(VALID_EVENTS)).min(1, "At least one event is required"),
});

export async function listWebhooksAction() {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

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
  const orgId = session.user.orgId;

  const validated = createWebhookSchema.parse(input);

  const secret = crypto.randomBytes(32).toString("hex");

  return db.webhookEndpoint.create({
    data: {
      orgId,
      url: validated.url,
      events: [...validated.events],
      secret,
    },
  });
}

export async function deleteWebhookAction(webhookId: string) {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  await db.webhookEndpoint.deleteMany({
    where: { id: webhookId, orgId },
  });
}

export async function toggleWebhookAction(webhookId: string) {
  await requirePermission(PERMISSIONS.API_KEYS);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id: webhookId, orgId },
  });
  if (!endpoint) throw new Error("Webhook not found");

  return db.webhookEndpoint.update({
    where: { id: webhookId },
    data: { isActive: !endpoint.isActive, failCount: 0, lastError: null },
  });
}