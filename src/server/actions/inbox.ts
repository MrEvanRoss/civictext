"use server";

import { requireOrg } from "./auth";
import { db } from "@/lib/db";

export async function listConversationsAction(opts?: {
  filter?: "all" | "unassigned" | "mine";
  page?: number;
}) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const userId = (session.user as any).id;
  const page = opts?.page || 1;
  const pageSize = 30;

  const where: any = { orgId };
  if (opts?.filter === "unassigned") {
    where.assignedToId = null;
  } else if (opts?.filter === "mine") {
    where.assignedToId = userId;
  }

  const [conversations, total] = await Promise.all([
    db.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contact: { select: { id: true, phone: true, firstName: true, lastName: true, tags: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    db.conversation.count({ where }),
  ]);

  return { conversations, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getConversationMessagesAction(conversationId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, orgId },
    include: {
      contact: true,
      assignedTo: { select: { name: true, email: true } },
    },
  });

  if (!conversation) throw new Error("Conversation not found");

  const messages = await db.message.findMany({
    where: { contactId: conversation.contactId, orgId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const notes = await db.conversationNote.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });

  return { conversation, messages, notes };
}

export async function sendReplyAction(conversationId: string, body: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, orgId },
    include: { contact: true },
  });

  if (!conversation) throw new Error("Conversation not found");

  // Create outbound message record (actual sending handled by worker)
  const message = await db.message.create({
    data: {
      orgId,
      contactId: conversation.contactId,
      direction: "OUTBOUND",
      body,
      status: "QUEUED",
    },
  });

  // Update conversation
  await db.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
    },
  });

  return message;
}

export async function addNoteAction(conversationId: string, body: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const userId = (session.user as any).id;

  return db.conversationNote.create({
    data: {
      conversationId,
      authorId: userId,
      body,
    },
    include: { author: { select: { name: true } } },
  });
}
