"use server";

import { requireOrg } from "./auth";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Get org info needed by growth tools (phone number, slug, name, welcome msg)
// ---------------------------------------------------------------------------

export async function getGrowthInfoAction() {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      name: true,
      slug: true,
      welcomeMessage: true,
      accentColor: true,
    },
  });

  const phone = await db.phoneNumber.findFirst({
    where: { orgId, status: "ACTIVE" },
    select: { phoneNumber: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    orgName: org.name,
    orgSlug: org.slug,
    phoneNumber: phone?.phoneNumber ?? null,
    welcomeMessage: org.welcomeMessage ?? "",
    accentColor: org.accentColor ?? null,
  };
}

// ---------------------------------------------------------------------------
// Update the welcome / activation text message
// ---------------------------------------------------------------------------

export async function updateWelcomeMessageAction(message: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  if (message.length > 1600) {
    throw new Error("Welcome message must be 1600 characters or fewer");
  }

  await db.organization.update({
    where: { id: orgId },
    data: { welcomeMessage: message || null },
  });

  return { success: true };
}
