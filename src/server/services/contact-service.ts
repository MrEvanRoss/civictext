import { db } from "@/lib/db";
import type { ContactFilter, CreateContactInput, UpdateContactInput, CreateSegmentInput } from "@/lib/validators/contacts";
import type { Prisma, OptInStatus } from "@prisma/client";

/**
 * Normalize a phone number to E.164 format.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

/**
 * List contacts with filtering, search, and pagination.
 */
export async function listContacts(orgId: string, filter: ContactFilter) {
  const where: Prisma.ContactWhereInput = { orgId };

  if (filter.search) {
    where.OR = [
      { phone: { contains: filter.search } },
      { firstName: { contains: filter.search, mode: "insensitive" } },
      { lastName: { contains: filter.search, mode: "insensitive" } },
      { email: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  if (filter.optInStatus) {
    where.optInStatus = filter.optInStatus;
  }

  if (filter.tags && filter.tags.length > 0) {
    where.tags = { hasSome: filter.tags };
  }

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      orderBy: { [filter.sortBy]: filter.sortOrder },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    db.contact.count({ where }),
  ]);

  return {
    contacts,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.ceil(total / filter.pageSize),
  };
}

/**
 * Get a single contact by ID.
 */
export async function getContact(orgId: string, contactId: string) {
  return db.contact.findFirst({
    where: { id: contactId, orgId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

/**
 * Create a new contact.
 */
export async function createContact(orgId: string, input: CreateContactInput) {
  const phone = normalizePhone(input.phone);

  // Check for duplicate
  const existing = await db.contact.findFirst({
    where: { orgId, phone },
  });
  if (existing) {
    throw new Error(`Contact with phone ${phone} already exists`);
  }

  const contact = await db.contact.create({
    data: {
      orgId,
      phone,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || undefined,
      tags: input.tags,
      customFields: (input.customFields || {}) as any,
      optInStatus: input.optInStatus,
      optInSource: input.optInSource || "manual",
      optInTimestamp: input.optInStatus === "OPTED_IN" ? new Date() : undefined,
    },
  });

  // Audit log for consent
  if (input.optInStatus === "OPTED_IN") {
    await db.consentAuditLog.create({
      data: {
        orgId,
        contactId: contact.id,
        action: "OPTED_IN",
        source: input.optInSource || "manual",
        metadata: { method: "manual_create" },
      },
    });
  }

  return contact;
}

/**
 * Update an existing contact.
 */
export async function updateContact(orgId: string, input: UpdateContactInput) {
  const existing = await db.contact.findFirst({
    where: { id: input.id, orgId },
  });
  if (!existing) throw new Error("Contact not found");

  const data: Prisma.ContactUpdateInput = {};

  if (input.phone) data.phone = normalizePhone(input.phone);
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.email !== undefined) data.email = input.email || null;
  if (input.tags) data.tags = input.tags;
  if (input.customFields) data.customFields = input.customFields as any;

  // Track opt-in status changes
  if (input.optInStatus && input.optInStatus !== existing.optInStatus) {
    data.optInStatus = input.optInStatus;
    if (input.optInStatus === "OPTED_IN") {
      data.optInTimestamp = new Date();
      data.optInSource = "manual_update";
    }

    await db.consentAuditLog.create({
      data: {
        orgId,
        contactId: input.id,
        action: input.optInStatus === "OPTED_IN" ? "OPTED_IN" : "OPTED_OUT",
        source: "manual_update",
        metadata: { previousStatus: existing.optInStatus },
      },
    });
  }

  return db.contact.update({
    where: { id: input.id },
    data,
  });
}

/**
 * Delete a contact (hard delete with anonymized message history).
 */
export async function deleteContact(orgId: string, contactId: string) {
  const contact = await db.contact.findFirst({
    where: { id: contactId, orgId },
  });
  if (!contact) throw new Error("Contact not found");

  // Anonymize message history (keep for analytics, remove PII)
  await db.message.updateMany({
    where: { contactId, orgId },
    data: { contactId: null as any },
  });

  // Delete consent audit logs
  await db.consentAuditLog.deleteMany({
    where: { contactId, orgId },
  });

  // Delete the contact
  await db.contact.delete({ where: { id: contactId } });
}

/**
 * Get all unique tags for an org.
 */
export async function getOrgTags(orgId: string): Promise<string[]> {
  const contacts = await db.contact.findMany({
    where: { orgId, tags: { isEmpty: false } },
    select: { tags: true },
  });

  const tagSet = new Set<string>();
  for (const c of contacts) {
    for (const tag of c.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * List segments for an org.
 */
export async function listSegments(orgId: string) {
  return db.segment.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create a new segment.
 */
export async function createSegment(orgId: string, input: CreateSegmentInput) {
  // Evaluate the segment to get an initial count
  const count = await evaluateSegmentCount(orgId, input.rules);

  return db.segment.create({
    data: {
      orgId,
      name: input.name,
      rules: input.rules as any,
      contactCount: count,
    },
  });
}

/**
 * Evaluate segment rules and return matching contact count.
 */
export async function evaluateSegmentCount(
  orgId: string,
  rules: CreateSegmentInput["rules"]
): Promise<number> {
  const where = buildSegmentWhere(orgId, rules);
  return db.contact.count({ where });
}

/**
 * Get contacts matching a segment's rules.
 */
export async function getSegmentContacts(
  orgId: string,
  segmentId: string,
  opts?: { skip?: number; take?: number }
) {
  const segment = await db.segment.findFirst({
    where: { id: segmentId, orgId },
  });
  if (!segment) throw new Error("Segment not found");

  const where = buildSegmentWhere(orgId, segment.rules as any);
  return db.contact.findMany({
    where,
    skip: opts?.skip,
    take: opts?.take,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Convert segment rules to Prisma where clause.
 */
function buildSegmentWhere(
  orgId: string,
  rules: CreateSegmentInput["rules"]
): Prisma.ContactWhereInput {
  const conditions = rules.conditions.map((cond) => {
    switch (cond.field) {
      case "optInStatus":
        return { optInStatus: cond.value as OptInStatus };
      case "tags":
        if (cond.operator === "in" || cond.operator === "contains") {
          return { tags: { hasSome: Array.isArray(cond.value) ? cond.value : [cond.value as string] } };
        }
        if (cond.operator === "not_contains" || cond.operator === "not_in") {
          return { NOT: { tags: { hasSome: Array.isArray(cond.value) ? cond.value : [cond.value as string] } } };
        }
        return {};
      case "firstName":
      case "lastName":
      case "email":
      case "phone":
        return buildStringCondition(cond.field, cond.operator, cond.value as string);
      case "lastMessageAt":
      case "createdAt":
        return buildDateCondition(cond.field, cond.operator, cond.value as string);
      default:
        // Custom field query
        if (cond.field.startsWith("custom.")) {
          const key = cond.field.replace("custom.", "");
          return {
            customFields: { path: [key], equals: cond.value },
          };
        }
        return {};
    }
  });

  if (rules.operator === "AND") {
    return { orgId, AND: conditions as Prisma.ContactWhereInput[] };
  }
  return { orgId, OR: conditions as Prisma.ContactWhereInput[] };
}

function buildStringCondition(
  field: string,
  operator: string,
  value: string
): Prisma.ContactWhereInput {
  switch (operator) {
    case "equals":
      return { [field]: value };
    case "not_equals":
      return { [field]: { not: value } };
    case "contains":
      return { [field]: { contains: value, mode: "insensitive" } };
    case "not_contains":
      return { NOT: { [field]: { contains: value, mode: "insensitive" } } };
    case "is_set":
      return { [field]: { not: null } };
    case "is_not_set":
      return { [field]: null };
    default:
      return {};
  }
}

function buildDateCondition(
  field: string,
  operator: string,
  value: string
): Prisma.ContactWhereInput {
  const date = new Date(value);
  switch (operator) {
    case "gt":
      return { [field]: { gt: date } };
    case "lt":
      return { [field]: { lt: date } };
    case "gte":
      return { [field]: { gte: date } };
    case "lte":
      return { [field]: { lte: date } };
    default:
      return {};
  }
}
