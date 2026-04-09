"use server";

import { requireOrg, requirePermission } from "./auth";
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  getOrgTags,
  listSegments,
  createSegment,
  evaluateSegmentCount,
} from "@/server/services/contact-service";
import {
  contactFilterSchema,
  createContactSchema,
  updateContactSchema,
  createSegmentSchema,
  type ContactFilter,
  type CreateContactInput,
  type UpdateContactInput,
  type CreateSegmentInput,
} from "@/lib/validators/contacts";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { z } from "zod";

const bulkContactIdsSchema = z.array(z.string().uuid()).min(1).max(10000);
const bulkTagsSchema = z.array(z.string().min(1).max(100)).min(1).max(50);

export async function listContactsAction(filter: Partial<ContactFilter>) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  const validated = contactFilterSchema.parse({ ...filter });
  return listContacts(orgId, validated);
}

export async function getContactAction(contactId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  return getContact(orgId, contactId);
}

export async function createContactAction(input: CreateContactInput) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  const validated = createContactSchema.parse(input);
  return createContact(orgId, validated);
}

export async function updateContactAction(input: UpdateContactInput) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  const validated = updateContactSchema.parse(input);
  return updateContact(orgId, validated);
}

export async function deleteContactAction(contactId: string) {
  await requirePermission(PERMISSIONS.CONTACTS_DELETE);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  await deleteContact(orgId, contactId);
  return { success: true };
}

export async function getOrgTagsAction() {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  return getOrgTags(orgId);
}

export async function listSegmentsAction() {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  return listSegments(orgId);
}

export async function createSegmentAction(input: CreateSegmentInput) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  const validated = createSegmentSchema.parse(input);
  return createSegment(orgId, validated);
}

export async function evaluateSegmentCountAction(
  rules: CreateSegmentInput["rules"]
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  return evaluateSegmentCount(orgId, rules);
}

/**
 * Bulk add tags to multiple contacts.
 */
export async function bulkAddTagsAction(contactIds: string[], tags: string[]) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const validatedIds = bulkContactIdsSchema.parse(contactIds);
  const validatedTags = bulkTagsSchema.parse(tags);

  if (validatedIds.length === 0 || validatedTags.length === 0) return { updated: 0 };

  let updated = 0;
  for (const contactId of validatedIds) {
    const contact = await db.contact.findFirst({
      where: { id: contactId, orgId, deletedAt: null },
      select: { tags: true },
    });
    if (!contact) continue;

    const existingTags = contact.tags || [];
    const newTags = Array.from(new Set([...existingTags, ...validatedTags]));

    await db.contact.update({
      where: { id: contactId },
      data: { tags: newTags },
    });
    updated++;
  }

  return { updated };
}

/**
 * Bulk remove tags from multiple contacts.
 */
export async function bulkRemoveTagsAction(contactIds: string[], tags: string[]) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const validatedIds = bulkContactIdsSchema.parse(contactIds);
  const validatedTags = bulkTagsSchema.parse(tags);

  let updated = 0;
  for (const contactId of validatedIds) {
    const contact = await db.contact.findFirst({
      where: { id: contactId, orgId, deletedAt: null },
      select: { tags: true },
    });
    if (!contact) continue;

    const newTags = (contact.tags || []).filter((t: string) => !validatedTags.includes(t));
    await db.contact.update({
      where: { id: contactId },
      data: { tags: newTags },
    });
    updated++;
  }

  return { updated };
}

/**
 * Bulk soft-delete contacts.
 */
export async function bulkDeleteContactsAction(contactIds: string[]) {
  await requirePermission(PERMISSIONS.CONTACTS_DELETE);
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const validatedIds = bulkContactIdsSchema.parse(contactIds);

  const result = await db.contact.updateMany({
    where: { id: { in: validatedIds }, orgId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return { deleted: result.count };
}

/**
 * Export contacts as CSV.
 */
export async function exportContactsAction(filter?: Partial<ContactFilter>) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const where: any = { orgId, deletedAt: null };
  if (filter?.search) {
    where.OR = [
      { phone: { contains: filter.search } },
      { firstName: { contains: filter.search, mode: "insensitive" } },
      { lastName: { contains: filter.search, mode: "insensitive" } },
      { email: { contains: filter.search, mode: "insensitive" } },
    ];
  }
  if (filter?.tags && filter.tags.length > 0) {
    where.tags = { hasSome: filter.tags };
  }
  if (filter?.optInStatus) {
    where.optInStatus = filter.optInStatus;
  }

  const contacts = await db.contact.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50000,
  });

  const rows: string[][] = [
    ["Phone", "First Name", "Last Name", "Email", "Prefix", "Suffix", "Tags", "Opt-In Status", "Precinct", "County", "Congressional District", "State Senate", "State House", "Created"],
  ];

  for (const c of contacts) {
    rows.push([
      c.phone,
      c.firstName || "",
      c.lastName || "",
      c.email || "",
      (c as any).prefix || "",
      (c as any).suffix || "",
      (c.tags || []).join("; "),
      c.optInStatus,
      (c as any).precinct || "",
      (c as any).county || "",
      (c as any).congressionalDistrict || "",
      (c as any).stateSenateDistrict || "",
      (c as any).stateHouseDistrict || "",
      new Date(c.createdAt).toISOString().split("T")[0],
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
    filename: `contacts-export-${new Date().toISOString().split("T")[0]}.csv`,
  };
}

/**
 * Get contact activity timeline (messages, notes, consent changes).
 */
export async function getContactTimelineAction(contactId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const contact = await db.contact.findFirst({
    where: { id: contactId, orgId, deletedAt: null },
  });
  if (!contact) throw new Error("Contact not found");

  const [messages, notes, consentLogs] = await Promise.all([
    db.message.findMany({
      where: { contactId, orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        direction: true,
        body: true,
        status: true,
        createdAt: true,
        campaign: { select: { name: true } },
      },
    }),
    db.contactNote.findMany({
      where: { contactId, orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { author: { select: { name: true } } },
    }),
    db.consentAuditLog.findMany({
      where: { contactId, orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Merge into unified timeline
  const timeline = [
    ...messages.map((m) => ({
      type: "message" as const,
      id: m.id,
      date: m.createdAt,
      direction: m.direction,
      body: m.body,
      status: m.status,
      campaignName: m.campaign?.name,
    })),
    ...notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      date: n.createdAt,
      body: n.body,
      authorName: n.author?.name,
    })),
    ...consentLogs.map((l) => ({
      type: "consent" as const,
      id: l.id,
      date: l.createdAt,
      action: l.action,
      source: l.source,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return timeline;
}

/**
 * Get notes for a contact.
 */
export async function getContactNotesAction(contactId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  return db.contactNote.findMany({
    where: { contactId, orgId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });
}

/**
 * Add a note to a contact.
 */
export async function addContactNoteAction(contactId: string, body: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  const userId = session.user.id;

  if (!body.trim()) throw new Error("Note body is required");

  const contact = await db.contact.findFirst({
    where: { id: contactId, orgId, deletedAt: null },
  });
  if (!contact) throw new Error("Contact not found");

  return db.contactNote.create({
    data: {
      orgId,
      contactId,
      authorId: userId,
      body: body.trim(),
    },
    include: { author: { select: { name: true } } },
  });
}

/**
 * Delete a contact note.
 */
export async function deleteContactNoteAction(noteId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  await db.contactNote.deleteMany({
    where: { id: noteId, orgId },
  });
}
