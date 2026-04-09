"use server";

import { requireOrg } from "./auth";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import {
  generateCampaignMessage,
  suggestReplies,
  improveMessage,
} from "@/server/services/ai-service";

/**
 * Check AI rate limit: 20 generations per org per hour.
 * Uses a Redis counter with an hourly key.
 */
async function checkAiRateLimit(orgId: string): Promise<void> {
  const hourKey = new Date().toISOString().slice(0, 13); // e.g. "2026-04-08T14"
  const key = `ai:ratelimit:${orgId}:${hourKey}`;
  const result = await rateLimit(key, 20, 3600); // 20 per hour
  if (!result.allowed) {
    throw new Error(
      `AI rate limit exceeded. You can generate up to 20 AI messages per hour. Try again later.`
    );
  }
}

/**
 * Generate campaign message variants using AI.
 */
export async function generateMessageAction(
  prompt: string,
  tone: string,
  maxLength: number
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Please describe what you want to say.");
  }
  if (maxLength < 1 || maxLength > 1600) {
    throw new Error("Invalid max length.");
  }

  await checkAiRateLimit(orgId);

  const variants = await generateCampaignMessage(prompt.trim(), tone, maxLength);
  return { variants };
}

/**
 * Suggest replies for a conversation using AI.
 */
export async function suggestRepliesAction(conversationId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  if (!conversationId) {
    throw new Error("Conversation ID is required.");
  }

  await checkAiRateLimit(orgId);

  // Fetch conversation and recent messages
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, orgId },
    include: {
      contact: {
        select: { firstName: true },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const messages = await db.message.findMany({
    where: { contactId: conversation.contactId, orgId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { direction: true, body: true },
  });

  // Reverse to get chronological order
  const history = messages
    .reverse()
    .filter((m) => m.body)
    .map((m) => ({ direction: m.direction, body: m.body! }));

  if (history.length === 0) {
    throw new Error("No messages found in this conversation.");
  }

  const suggestions = await suggestReplies(history, {
    firstName: conversation.contact.firstName || undefined,
  });

  return { suggestions };
}

/**
 * Improve/rewrite a message using AI.
 */
export async function improveMessageAction(
  message: string,
  instruction: string
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  if (!message || message.trim().length === 0) {
    throw new Error("Message is required.");
  }
  if (!instruction || instruction.trim().length === 0) {
    throw new Error("Improvement instruction is required.");
  }

  await checkAiRateLimit(orgId);

  const improved = await improveMessage(message.trim(), instruction.trim());
  return { improved };
}
