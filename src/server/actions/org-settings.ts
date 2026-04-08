"use server";

import { requireOrg } from "./auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const orgSettingsSchema = z.object({
  // General
  name: z.string().min(1, "Organization name is required").max(200),
  timezone: z.string().min(1, "Timezone is required"),
  // Signup Messages
  welcomeMessage: z.string().max(1600).optional().nullable(),
  optOutMessage: z.string().max(1600).optional().nullable(),
  // Customize
  politicalDisclaimer: z.string().max(500).optional().nullable(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  messageSignature: z.string().max(500).optional().nullable(),
  // Appearance
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
    .optional()
    .nullable(),
  // Branding
  logoUrl: z.string().max(500).optional().nullable(),
});

export type OrgSettings = z.infer<typeof orgSettingsSchema>;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getOrgSettingsAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      name: true,
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      politicalDisclaimer: true,
      welcomeMessage: true,
      optOutMessage: true,
      messageSignature: true,
      accentColor: true,
      logoUrl: true,
    },
  });

  // Also fetch the first active phone number for display
  const phone = await db.phoneNumber.findFirst({
    where: { orgId, status: "ACTIVE" },
    select: { phoneNumber: true },
    orderBy: { createdAt: "asc" },
  });

  // Fetch Twilio subaccount info for the integrations tab
  const twilio = await db.twilioSubaccount.findUnique({
    where: { orgId },
    select: { accountSid: true },
  });

  // Current user info
  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
    select: { name: true, email: true },
  });

  return {
    ...org,
    phoneNumber: phone?.phoneNumber ?? null,
    twilioAccountSid: twilio?.accountSid ?? null,
    userName: user?.name ?? "",
    userEmail: user?.email ?? "",
  };
}

// ---------------------------------------------------------------------------
// Sidebar branding (lightweight query)
// ---------------------------------------------------------------------------

export async function getOrgBrandingAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      name: true,
      logoUrl: true,
    },
  });

  return org;
}

// ---------------------------------------------------------------------------
// Update logo URL
// ---------------------------------------------------------------------------

export async function updateOrgLogoAction(logoUrl: string | null) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  await db.organization.update({
    where: { id: orgId },
    data: { logoUrl },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateOrgSettingsAction(settings: OrgSettings) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const validated = orgSettingsSchema.parse(settings);

  await db.organization.update({
    where: { id: orgId },
    data: {
      name: validated.name,
      timezone: validated.timezone,
      quietHoursStart: validated.quietHoursStart,
      quietHoursEnd: validated.quietHoursEnd,
      politicalDisclaimer: validated.politicalDisclaimer ?? null,
      welcomeMessage: validated.welcomeMessage ?? null,
      optOutMessage: validated.optOutMessage ?? null,
      messageSignature: validated.messageSignature ?? null,
      accentColor: validated.accentColor ?? null,
      logoUrl: validated.logoUrl ?? null,
    },
  });

  return { success: true };
}
