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
  filter?: "all" | "unassigned" | "mine" | "escalated";
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
  } else if (opts?.filter === "escalated") {
    where.isEscalated = true;
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
      contact: {
        include: {
          contactNotes: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { author: { select: { name: true } } },
          },
        },
      },
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

/**
 * Add a note about a contact (visible on contact's profile in inbox sidebar).
 */
export async function addContactNoteAction(contactId: string, body: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const userId = (session.user as any).id;

  const contact = await db.contact.findFirst({
    where: { id: contactId, orgId },
  });
  if (!contact) throw new Error("Contact not found");

  return db.contactNote.create({
    data: {
      orgId,
      contactId,
      authorId: userId,
      body,
    },
    include: { author: { select: { name: true } } },
  });
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

/**
 * Escalate a conversation for supervisor review.
 */
export async function escalateConversationAction(
  conversationId: string,
  reason: string
) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const userId = (session.user as any).id;

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, orgId },
  });
  if (!conversation) throw new Error("Conversation not found");

  const updated = await db.conversation.update({
    where: { id: conversationId },
    data: {
      isEscalated: true,
      escalatedReason: reason,
      escalatedAt: new Date(),
      escalatedById: userId,
    },
  });

  // Add a note about the escalation
  await db.conversationNote.create({
    data: {
      conversationId,
      authorId: userId,
      body: `Escalated: ${reason}`,
    },
  });

  return updated;
}

/**
 * Resolve an escalated conversation.
 */
export async function resolveEscalationAction(conversationId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  return db.conversation.update({
    where: { id: conversationId },
    data: {
      isEscalated: false,
      escalatedReason: null,
      escalatedAt: null,
      escalatedById: null,
    },
  });
}

/**
 * Tag a conversation with response codes (e.g., "supportive", "undecided", "hostile").
 */
export async function tagConversationAction(
  conversationId: string,
  tags: string[]
) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, orgId },
  });
  if (!conversation) throw new Error("Conversation not found");

  return db.conversation.update({
    where: { id: conversationId },
    data: { responseTags: tags },
  });
}

/**
 * Assign a conversation to a specific user.
 */
export async function assignConversationAction(
  conversationId: string,
  userId: string | null
) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  return db.conversation.update({
    where: { id: conversationId },
    data: { assignedToId: userId },
  });
}

/**
 * Auto-assign unassigned conversations using round-robin.
 */
export async function autoAssignConversationsAction() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  // Get active senders/agents
  const agents = await db.user.findMany({
    where: {
      orgId,
      role: { in: ["SENDER", "MANAGER", "ADMIN", "OWNER"] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (agents.length === 0) throw new Error("No agents available for assignment");

  // Get unassigned open conversations
  const unassigned = await db.conversation.findMany({
    where: { orgId, assignedToId: null, state: "OPEN" },
    orderBy: { lastMessageAt: "desc" },
  });

  if (unassigned.length === 0) return { assigned: 0 };

  // Get current assignment counts per agent
  const counts = await db.conversation.groupBy({
    by: ["assignedToId"],
    where: { orgId, state: "OPEN", assignedToId: { not: null } },
    _count: true,
  });

  const countMap = new Map(counts.map((c) => [c.assignedToId, c._count]));

  // Sort agents by current load (fewest assignments first)
  const sortedAgents = [...agents].sort(
    (a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0)
  );

  // Round-robin assign
  let assigned = 0;
  for (let i = 0; i < unassigned.length; i++) {
    const agent = sortedAgents[i % sortedAgents.length];
    await db.conversation.update({
      where: { id: unassigned[i].id },
      data: { assignedToId: agent.id },
    });
    assigned++;
  }

  return { assigned };
}

/**
 * Send a double opt-in confirmation message to a contact.
 * Sets contact to PENDING and sends a message asking them to reply YES to confirm.
 */
export async function sendDoubleOptInAction(contactId: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_SEND);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const contact = await db.contact.findFirst({
    where: { id: contactId, orgId },
  });
  if (!contact) throw new Error("Contact not found");
  if (contact.optInStatus === "OPTED_IN") {
    throw new Error("Contact is already opted in");
  }
  if (contact.optInStatus === "OPTED_OUT") {
    throw new Error("Contact has opted out and must text START themselves");
  }

  // Set to PENDING (awaiting confirmation)
  await db.contact.update({
    where: { id: contactId },
    data: {
      optInStatus: "PENDING",
      optInSource: "double_opt_in",
    },
  });

  // Queue the confirmation message
  const confirmBody = "Reply YES to confirm you'd like to receive text messages from us. Reply STOP at any time to unsubscribe.";

  const message = await db.message.create({
    data: {
      orgId,
      contactId,
      direction: "OUTBOUND",
      body: confirmBody,
      status: "QUEUED",
    },
  });

  await messageQueue.add("send", {
    orgId,
    contactId,
    messageBody: confirmBody,
    phone: contact.phone,
    firstName: contact.firstName,
    lastName: contact.lastName,
    messageId: message.id,
  }, { priority: 1 });

  await db.consentAuditLog.create({
    data: {
      orgId,
      contactId,
      action: "CONSENT_UPDATED",
      source: "double_opt_in_sent",
      metadata: { initiatedBy: (session.user as any).id },
    },
  });

  return { sent: true };
}

/**
 * Get team members for assignment dropdown.
 */
export async function getTeamMembersAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  return db.user.findMany({
    where: { orgId },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

/**
 * List quick reply templates for the inbox.
 */
export async function listQuickRepliesAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  return db.quickReplyTemplate.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
  });
}

/**
 * Create a quick reply template.
 */
export async function createQuickReplyAction(name: string, body: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  if (!name.trim() || !body.trim()) throw new Error("Name and body are required");

  return db.quickReplyTemplate.create({
    data: { orgId, name: name.trim(), body: body.trim() },
  });
}

/**
 * Delete a quick reply template.
 */
export async function deleteQuickReplyAction(templateId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  await db.quickReplyTemplate.deleteMany({
    where: { id: templateId, orgId },
  });
}

/**
 * Mark a conversation as closed/resolved.
 */
export async function closeConversationAction(conversationId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  return db.conversation.update({
    where: { id: conversationId },
    data: { state: "CLOSED" },
  });
}

/**
 * Reopen a closed conversation.
 */
export async function reopenConversationAction(conversationId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  return db.conversation.update({
    where: { id: conversationId },
    data: { state: "OPEN" },
  });
}
