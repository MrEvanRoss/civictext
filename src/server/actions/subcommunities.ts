"use server";

import { db } from "@/lib/db";
import { requireOrg } from "./auth";

// ---------------------------------------------------------------------------
// List subcommunities for the current org
// ---------------------------------------------------------------------------
export async function listSubcommunitiesAction() {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  return db.subcommunity.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Get a single subcommunity with member count
// ---------------------------------------------------------------------------
export async function getSubcommunityAction(id: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const subcommunity = await db.subcommunity.findFirst({
    where: { id, orgId },
    include: {
      _count: { select: { members: true } },
    },
  });

  if (!subcommunity) throw new Error("Subcommunity not found");
  return subcommunity;
}

// ---------------------------------------------------------------------------
// Create subcommunity
// ---------------------------------------------------------------------------
export async function createSubcommunityAction(data: {
  name: string;
  description?: string;
  joinKeyword?: string;
  isPublic?: boolean;
}) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const name = data.name.trim();
  if (!name) throw new Error("Name is required");

  const joinKeyword = data.joinKeyword?.toUpperCase().trim() || null;

  // Check keyword doesn't conflict with system keywords
  if (joinKeyword) {
    const { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } = await import("@/lib/constants");
    if ([...OPT_OUT_KEYWORDS, ...OPT_IN_KEYWORDS].includes(joinKeyword)) {
      throw new Error(`"${joinKeyword}" is a reserved system keyword and cannot be used.`);
    }

    // Check keyword uniqueness within org (across subcommunities and interest lists)
    const existingSubcommunity = await db.subcommunity.findFirst({
      where: { orgId, joinKeyword },
    });
    if (existingSubcommunity) {
      throw new Error(`A subcommunity with keyword "${joinKeyword}" already exists.`);
    }

    const existingInterestList = await db.interestList.findFirst({
      where: { orgId, keyword: joinKeyword },
    });
    if (existingInterestList) {
      throw new Error(`An interest list already uses keyword "${joinKeyword}".`);
    }
  }

  // Check name uniqueness within org
  const existingName = await db.subcommunity.findFirst({
    where: { orgId, name },
  });
  if (existingName) {
    throw new Error(`A subcommunity named "${name}" already exists.`);
  }

  return db.subcommunity.create({
    data: {
      orgId,
      name,
      description: data.description?.trim() || null,
      joinKeyword,
      isPublic: data.isPublic ?? true,
    },
  });
}

// ---------------------------------------------------------------------------
// Update subcommunity
// ---------------------------------------------------------------------------
export async function updateSubcommunityAction(
  id: string,
  data: {
    name?: string;
    description?: string;
    joinKeyword?: string;
    isPublic?: boolean;
  }
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const existing = await db.subcommunity.findFirst({
    where: { id, orgId },
  });
  if (!existing) throw new Error("Subcommunity not found");

  const updateData: Record<string, any> = {};

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error("Name is required");
    // Check name uniqueness (excluding current)
    const duplicate = await db.subcommunity.findFirst({
      where: { orgId, name, id: { not: id } },
    });
    if (duplicate) throw new Error(`A subcommunity named "${name}" already exists.`);
    updateData.name = name;
  }

  if (data.joinKeyword !== undefined) {
    const joinKeyword = data.joinKeyword.toUpperCase().trim() || null;
    if (joinKeyword) {
      const { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } = await import("@/lib/constants");
      if ([...OPT_OUT_KEYWORDS, ...OPT_IN_KEYWORDS].includes(joinKeyword)) {
        throw new Error(`"${joinKeyword}" is a reserved system keyword.`);
      }
      const duplicateKw = await db.subcommunity.findFirst({
        where: { orgId, joinKeyword, id: { not: id } },
      });
      if (duplicateKw) throw new Error(`Keyword "${joinKeyword}" is already in use.`);

      const existingInterestList = await db.interestList.findFirst({
        where: { orgId, keyword: joinKeyword },
      });
      if (existingInterestList) {
        throw new Error(`An interest list already uses keyword "${joinKeyword}".`);
      }
    }
    updateData.joinKeyword = joinKeyword;
  }

  if (data.description !== undefined) {
    updateData.description = data.description.trim() || null;
  }

  if (data.isPublic !== undefined) {
    updateData.isPublic = data.isPublic;
  }

  return db.subcommunity.update({
    where: { id },
    data: updateData,
  });
}

// ---------------------------------------------------------------------------
// Delete subcommunity (cascades members via schema)
// ---------------------------------------------------------------------------
export async function deleteSubcommunityAction(id: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const existing = await db.subcommunity.findFirst({
    where: { id, orgId },
  });
  if (!existing) throw new Error("Subcommunity not found");

  await db.subcommunity.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Get subcommunity members (paginated, with search & sort)
// ---------------------------------------------------------------------------
export async function getSubcommunityMembersAction(
  subcommunityId: string,
  filters?: {
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?: "name" | "joinedAt" | "phone";
    sortOrder?: "asc" | "desc";
  }
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  // Verify subcommunity belongs to org
  const subcommunity = await db.subcommunity.findFirst({
    where: { id: subcommunityId, orgId },
  });
  if (!subcommunity) throw new Error("Subcommunity not found");

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const sortOrder = filters?.sortOrder ?? "desc";
  const search = filters?.search?.trim();

  // Build where clause
  const where: any = { subcommunityId };
  if (search) {
    where.contact = {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    };
  }

  // Build orderBy
  let orderBy: any;
  switch (filters?.sortBy) {
    case "name":
      orderBy = { contact: { firstName: sortOrder } };
      break;
    case "phone":
      orderBy = { contact: { phone: sortOrder } };
      break;
    case "joinedAt":
    default:
      orderBy = { joinedAt: sortOrder };
      break;
  }

  const [members, total] = await Promise.all([
    db.subcommunityMember.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            optInStatus: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.subcommunityMember.count({ where }),
  ]);

  return {
    members,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ---------------------------------------------------------------------------
// Add members (bulk)
// ---------------------------------------------------------------------------
export async function addMembersAction(
  subcommunityId: string,
  contactIds: string[]
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const subcommunity = await db.subcommunity.findFirst({
    where: { id: subcommunityId, orgId },
  });
  if (!subcommunity) throw new Error("Subcommunity not found");

  // Verify contacts belong to this org
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds }, orgId },
    select: { id: true },
  });
  const validIds = contacts.map((c) => c.id);

  // Skip existing members
  const existingMembers = await db.subcommunityMember.findMany({
    where: { subcommunityId, contactId: { in: validIds } },
    select: { contactId: true },
  });
  const existingSet = new Set(existingMembers.map((m) => m.contactId));
  const newIds = validIds.filter((id) => !existingSet.has(id));

  if (newIds.length > 0) {
    await db.subcommunityMember.createMany({
      data: newIds.map((contactId) => ({
        subcommunityId,
        contactId,
        source: "manual",
      })),
    });

    // Update member count
    const count = await db.subcommunityMember.count({
      where: { subcommunityId },
    });
    await db.subcommunity.update({
      where: { id: subcommunityId },
      data: { memberCount: count },
    });
  }

  return { added: newIds.length, skipped: validIds.length - newIds.length };
}

// ---------------------------------------------------------------------------
// Remove a member
// ---------------------------------------------------------------------------
export async function removeMemberAction(
  subcommunityId: string,
  contactId: string
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const subcommunity = await db.subcommunity.findFirst({
    where: { id: subcommunityId, orgId },
  });
  if (!subcommunity) throw new Error("Subcommunity not found");

  await db.subcommunityMember.deleteMany({
    where: { subcommunityId, contactId },
  });

  // Update member count
  const count = await db.subcommunityMember.count({
    where: { subcommunityId },
  });
  await db.subcommunity.update({
    where: { id: subcommunityId },
    data: { memberCount: count },
  });
}

// ---------------------------------------------------------------------------
// Join by keyword (called when a contact texts a join keyword)
// ---------------------------------------------------------------------------
export async function joinByKeywordAction(
  orgId: string,
  keyword: string,
  contactId: string
) {
  const normalizedKeyword = keyword.toUpperCase().trim();

  const subcommunity = await db.subcommunity.findFirst({
    where: { orgId, joinKeyword: normalizedKeyword },
  });
  if (!subcommunity) return null; // No matching subcommunity

  // Check if already a member
  const existing = await db.subcommunityMember.findFirst({
    where: { subcommunityId: subcommunity.id, contactId },
  });
  if (existing) return { alreadyMember: true, subcommunity };

  await db.subcommunityMember.create({
    data: {
      subcommunityId: subcommunity.id,
      contactId,
      source: "keyword",
    },
  });

  // Update member count
  await db.subcommunity.update({
    where: { id: subcommunity.id },
    data: { memberCount: { increment: 1 } },
  });

  return { alreadyMember: false, subcommunity };
}

// ---------------------------------------------------------------------------
// Search contacts for the add-members modal
// ---------------------------------------------------------------------------
export async function searchContactsForSubcommunityAction(
  subcommunityId: string,
  search: string
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const query = search.trim();
  if (!query) return [];

  // Get contacts matching search that are NOT already members
  const existingMemberIds = await db.subcommunityMember.findMany({
    where: { subcommunityId },
    select: { contactId: true },
  });
  const excludeIds = existingMemberIds.map((m) => m.contactId);

  return db.contact.findMany({
    where: {
      orgId,
      id: { notIn: excludeIds },
      deletedAt: null,
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      optInStatus: true,
    },
    take: 20,
    orderBy: { firstName: "asc" },
  });
}
