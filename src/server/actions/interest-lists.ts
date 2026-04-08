"use server";

import { db } from "@/lib/db";
import { requireAuth } from "./auth";

/**
 * List all interest lists for the current org.
 */
export async function listInterestListsAction() {
  const { orgId } = await requireAuth();

  return db.interestList.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true } },
    },
  });
}

/**
 * Get a single interest list with its members.
 */
export async function getInterestListAction(listId: string) {
  const { orgId } = await requireAuth();

  return db.interestList.findFirst({
    where: { id: listId, orgId },
    include: {
      members: {
        include: {
          contact: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              email: true,
              optInStatus: true,
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      },
    },
  });
}

/**
 * Create a new interest list.
 */
export async function createInterestListAction(input: {
  name: string;
  keyword: string;
  description?: string;
  welcomeMessage?: string;
}) {
  const { orgId } = await requireAuth("MANAGER");

  const keyword = input.keyword.toUpperCase().trim();

  if (!keyword) throw new Error("Keyword is required");
  if (!input.name.trim()) throw new Error("Name is required");

  // Check keyword doesn't conflict with opt-in/opt-out keywords
  const { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } = await import("@/lib/constants");
  if ([...OPT_OUT_KEYWORDS, ...OPT_IN_KEYWORDS].includes(keyword)) {
    throw new Error(`"${keyword}" is a reserved system keyword and cannot be used.`);
  }

  // Check keyword uniqueness within org
  const existing = await db.interestList.findFirst({
    where: { orgId, keyword },
  });
  if (existing) {
    throw new Error(`An interest list with keyword "${keyword}" already exists.`);
  }

  return db.interestList.create({
    data: {
      orgId,
      name: input.name.trim(),
      keyword,
      description: input.description?.trim() || null,
      welcomeMessage: input.welcomeMessage?.trim() || null,
    },
  });
}

/**
 * Update an interest list.
 */
export async function updateInterestListAction(
  listId: string,
  input: {
    name?: string;
    description?: string;
    welcomeMessage?: string;
    isActive?: boolean;
  }
) {
  const { orgId } = await requireAuth("MANAGER");

  const existing = await db.interestList.findFirst({
    where: { id: listId, orgId },
  });
  if (!existing) throw new Error("Interest list not found");

  return db.interestList.update({
    where: { id: listId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description.trim() || null }),
      ...(input.welcomeMessage !== undefined && { welcomeMessage: input.welcomeMessage.trim() || null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
}

/**
 * Delete an interest list.
 */
export async function deleteInterestListAction(listId: string) {
  const { orgId } = await requireAuth("ADMIN");

  const existing = await db.interestList.findFirst({
    where: { id: listId, orgId },
  });
  if (!existing) throw new Error("Interest list not found");

  await db.interestList.delete({ where: { id: listId } });
}

/**
 * Add a contact to an interest list manually.
 */
export async function addMemberAction(listId: string, contactId: string) {
  const { orgId } = await requireAuth();

  const list = await db.interestList.findFirst({
    where: { id: listId, orgId },
  });
  if (!list) throw new Error("Interest list not found");

  const contact = await db.contact.findFirst({
    where: { id: contactId, orgId },
  });
  if (!contact) throw new Error("Contact not found");

  // Check if already a member
  const existing = await db.interestListMember.findFirst({
    where: { interestListId: listId, contactId },
  });
  if (existing) throw new Error("Contact is already on this list");

  const member = await db.interestListMember.create({
    data: {
      interestListId: listId,
      contactId,
      source: "manual",
    },
  });

  // Update member count
  await db.interestList.update({
    where: { id: listId },
    data: { memberCount: { increment: 1 } },
  });

  return member;
}

/**
 * Remove a contact from an interest list.
 */
export async function removeMemberAction(listId: string, contactId: string) {
  const { orgId } = await requireAuth();

  const list = await db.interestList.findFirst({
    where: { id: listId, orgId },
  });
  if (!list) throw new Error("Interest list not found");

  await db.interestListMember.deleteMany({
    where: { interestListId: listId, contactId },
  });

  // Update member count
  const count = await db.interestListMember.count({
    where: { interestListId: listId },
  });
  await db.interestList.update({
    where: { id: listId },
    data: { memberCount: count },
  });
}

/**
 * Bulk add contacts to an interest list (e.g., by tag or segment).
 */
export async function bulkAddMembersAction(listId: string, contactIds: string[]) {
  const { orgId } = await requireAuth("MANAGER");

  const list = await db.interestList.findFirst({
    where: { id: listId, orgId },
  });
  if (!list) throw new Error("Interest list not found");

  // Verify all contacts belong to this org
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds }, orgId },
    select: { id: true },
  });

  const validIds = contacts.map((c) => c.id);

  // Skip duplicates
  const existingMembers = await db.interestListMember.findMany({
    where: { interestListId: listId, contactId: { in: validIds } },
    select: { contactId: true },
  });
  const existingSet = new Set(existingMembers.map((m) => m.contactId));
  const newIds = validIds.filter((id) => !existingSet.has(id));

  if (newIds.length > 0) {
    await db.interestListMember.createMany({
      data: newIds.map((contactId) => ({
        interestListId: listId,
        contactId,
        source: "manual",
      })),
    });

    // Update member count
    const count = await db.interestListMember.count({
      where: { interestListId: listId },
    });
    await db.interestList.update({
      where: { id: listId },
      data: { memberCount: count },
    });
  }

  return { added: newIds.length, skipped: validIds.length - newIds.length };
}

/**
 * Get interest lists that a specific contact belongs to.
 */
export async function getContactInterestListsAction(contactId: string) {
  const { orgId } = await requireAuth();

  return db.interestListMember.findMany({
    where: {
      contactId,
      interestList: { orgId },
    },
    include: {
      interestList: {
        select: { id: true, name: true, keyword: true },
      },
    },
  });
}
