"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const messageQueue = new Queue("messages", { connection });

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

  // Create outbound message record
  const message = await db.message.create({
    data: {
      orgId,
      contactId: conversation.contactId,
      direction: "OUTBOUND",
      body,
      status: "QUEUED",
    },
  });

  // Queue the message for actual sending via Twilio
  await messageQueue.add("send", {
    orgId,
    contactId: conversation.contactId,
    messageBody: body,
    phone: conversation.contact.phone,
    firstName: conversation.contact.firstName,
    lastName: conversation.contact.lastName,
    messageId: message.id,
  }, { priority: 1 }); // Priority 1 = highest for replies

  // Update conversation
  await db.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
    },
  });

  return message;
}

/**
 * Send a quick one-off message to a contact (no campaign required).
 */
export async function quickSendAction(data: {
  contactId: string;
  body: string;
  mediaUrl?: string;
}) {
  await requirePermission(PERMISSIONS.CAMPAIGN_SEND);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const contact = await db.contact.findFirst({
    where: { id: data.contactId, orgId },
  });

  if (!contact) throw new Error("Contact not found");
  if (contact.optInStatus === "OPTED_OUT") {
    throw new Error("Cannot send to opted-out contact");
  }

  // Create message record
  const message = await db.message.create({
    data: {
      orgId,
      contactId: contact.id,
      direction: "OUTBOUND",
      body: data.body,
      mediaUrl: data.mediaUrl || null,
      status: "QUEUED",
    },
  });

  // Queue for sending
  await messageQueue.add("send", {
    orgId,
    contactId: contact.id,
    messageBody: data.body,
    mediaUrl: data.mediaUrl || undefined,
    phone: contact.phone,
    firstName: contact.firstName,
    lastName: contact.lastName,
    messageId: message.id,
  }, { priority: 1 });

  // Create or update conversation
  await db.conversation.upsert({
    where: { orgId_contactId: { orgId, contactId: contact.id } },
    create: {
      orgId,
      contactId: contact.id,
      lastMessageAt: new Date(),
    },
    update: {
      lastMessageAt: new Date(),
    },
  });

  return message;
}

export async function exportConversationAction(conversationId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, orgId },
    include: {
      contact: { select: { phone: true, firstName: true, lastName: true } },
    },
  });

  if (!conversation) throw new Error("Conversation not found");

  const messages = await db.message.findMany({
    where: { contactId: conversation.contactId, orgId },
    orderBy: { createdAt: "asc" },
  });

  const notes = await db.conversationNote.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });

  // Build CSV rows
  const rows: string[][] = [
    ["Date", "Time", "Direction", "Type", "From", "Body", "Status"],
  ];

  const contactName = [conversation.contact.firstName, conversation.contact.lastName]
    .filter(Boolean)
    .join(" ") || conversation.contact.phone;

  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    rows.push([
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      msg.direction,
      "Message",
      msg.direction === "INBOUND" ? contactName : "You",
      msg.body || "",
      msg.status,
    ]);
  }

  for (const note of notes) {
    const date = new Date(note.createdAt);
    rows.push([
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      "",
      "Internal Note",
      note.author?.name || "Team",
      note.body,
      "",
    ]);
  }

  // Sort all rows (after header) by date+time
  const header = rows[0];
  const dataRows = rows.slice(1).sort((a, b) => {
    const dateA = new Date(`${a[0]} ${a[1]}`);
    const dateB = new Date(`${b[0]} ${b[1]}`);
    return dateA.getTime() - dateB.getTime();
  });

  // Convert to CSV string
  const csvLines = [header, ...dataRows].map((row) =>
    row.map((cell) => {
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(",")
  );

  return {
    csv: csvLines.join("\n"),
    filename: `conversation-${conversation.contact.phone}-${new Date().toISOString().split("T")[0]}.csv`,
  };
}

export async function exportAllConversationsAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const conversations = await db.conversation.findMany({
    where: { orgId },
    include: {
      contact: { select: { phone: true, firstName: true, lastName: true } },
    },
  });

  const contactIds = conversations.map((c) => c.contactId);

  const messages = await db.message.findMany({
    where: { orgId, contactId: { in: contactIds } },
    orderBy: { createdAt: "asc" },
    include: {
      contact: { select: { phone: true, firstName: true, lastName: true } },
    },
  });

  const rows: string[][] = [
    ["Date", "Time", "Contact Phone", "Contact Name", "Direction", "Body", "Status"],
  ];

  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    const contactName = [msg.contact?.firstName, msg.contact?.lastName]
      .filter(Boolean)
      .join(" ") || msg.contact?.phone || "";
    rows.push([
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      msg.contact?.phone || "",
      contactName,
      msg.direction,
      msg.body || "",
      msg.status,
    ]);
  }

  const csvLines = rows.map((row) =>
    row.map((cell) => {
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(",")
  );

  return {
    csv: csvLines.join("\n"),
    filename: `all-conversations-${new Date().toISOString().split("T")[0]}.csv`,
  };
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
