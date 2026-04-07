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

export async function listContactsAction(filter: Partial<ContactFilter>) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const validated = contactFilterSchema.parse({ ...filter });
  return listContacts(orgId, validated);
}

export async function getContactAction(contactId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  return getContact(orgId, contactId);
}

export async function createContactAction(input: CreateContactInput) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const validated = createContactSchema.parse(input);
  return createContact(orgId, validated);
}

export async function updateContactAction(input: UpdateContactInput) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const validated = updateContactSchema.parse(input);
  return updateContact(orgId, validated);
}

export async function deleteContactAction(contactId: string) {
  await requirePermission(PERMISSIONS.CONTACTS_DELETE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  await deleteContact(orgId, contactId);
  return { success: true };
}

export async function getOrgTagsAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  return getOrgTags(orgId);
}

export async function listSegmentsAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  return listSegments(orgId);
}

export async function createSegmentAction(input: CreateSegmentInput) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const validated = createSegmentSchema.parse(input);
  return createSegment(orgId, validated);
}

export async function evaluateSegmentCountAction(
  rules: CreateSegmentInput["rules"]
) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  return evaluateSegmentCount(orgId, rules);
}
