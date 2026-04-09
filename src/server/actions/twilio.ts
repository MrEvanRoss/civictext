"use server";

import { requireOrg, requireRole } from "./auth";
import {
  provisionSubaccount,
  createMessagingService,
  registerBrand,
  registerCampaign,
  provisionPhoneNumbers,
  releasePhoneNumber,
  getRegistrationStatus,
} from "@/server/services/twilio-service";
import {
  brandRegistrationSchema,
  campaignRegistrationSchema,
  provisionNumberSchema,
} from "@/lib/validators/twilio";
import { db } from "@/lib/db";

export async function getRegistrationStatusAction() {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;
  return getRegistrationStatus(orgId);
}

export async function provisionSubaccountAction() {
  const session = await requireRole("ADMIN");
  const orgId = session.user.orgId;

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organization not found");

  return provisionSubaccount(orgId, org.name);
}

export async function createMessagingServiceAction() {
  const session = await requireRole("ADMIN");
  const orgId = session.user.orgId;

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organization not found");

  await createMessagingService(orgId, org.name);
  return { success: true };
}

export async function registerBrandAction(formData: {
  brandName: string;
  ein?: string;
  brandType: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  website?: string;
  contactEmail: string;
  contactPhone: string;
}) {
  const session = await requireRole("ADMIN");
  const orgId = session.user.orgId;

  const validated = brandRegistrationSchema.parse(formData);
  return registerBrand(orgId, validated);
}

export async function registerCampaignAction(formData: {
  brandRegistrationId: string;
  useCase: string;
  description: string;
  sampleMessages: string[];
  messageFlow: string;
}) {
  const session = await requireRole("ADMIN");
  const orgId = session.user.orgId;

  const validated = campaignRegistrationSchema.parse(formData);
  return registerCampaign(orgId, validated);
}

export async function provisionPhoneNumbersAction(formData: {
  areaCode?: string;
  quantity?: number;
}) {
  const session = await requireRole("ADMIN");
  const orgId = session.user.orgId;

  const validated = provisionNumberSchema.parse(formData);
  return provisionPhoneNumbers(orgId, validated);
}

export async function releasePhoneNumberAction(phoneNumberId: string) {
  const session = await requireRole("ADMIN");
  const orgId = session.user.orgId;

  await releasePhoneNumber(orgId, phoneNumberId);
  return { success: true };
}
