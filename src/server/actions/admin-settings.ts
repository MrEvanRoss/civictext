"use server";

import { requireSuperAdmin } from "./auth";
import { db } from "@/lib/db";
import { z } from "zod";

const settingsSchema = z.object({
  defaultSmsRateCents: z.number().min(0).max(100),
  defaultMmsRateCents: z.number().min(0).max(200),
  defaultPhoneNumberFeeCents: z.number().int().min(0).max(10000),
  minimumCreditsDollars: z.number().int().min(1).max(1000),
  maxOptOutRatePercent: z.number().min(0).max(100),
  maxFailureRatePercent: z.number().min(0).max(100),
  autoSuspendOnHighOptOut: z.boolean(),
  enforceQuietHours: z.boolean(),
  defaultQuietHoursStart: z.string(),
  defaultQuietHoursEnd: z.string(),
  adminNotificationEmail: z.string().email().or(z.literal("")),
  alertOnNewOrg: z.boolean(),
  alertOnHighOptOut: z.boolean(),
  alertOnPaymentFailure: z.boolean(),
  platformName: z.string().min(1).max(100),
  supportEmail: z.string().email().or(z.literal("")),
  supportPhone: z.string().max(20),
  maintenanceMode: z.boolean(),
});

type AdminSettings = z.infer<typeof settingsSchema>;

/**
 * Admin settings are stored as key-value pairs in a PlatformSetting model.
 * If the model doesn't exist yet, we return defaults and create on first save.
 */
export async function getAdminSettingsAction(): Promise<AdminSettings | null> {
  await requireSuperAdmin();

  try {
    const rows = await db.platformSetting.findMany();
    if (rows.length === 0) return null;

    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }

    return {
      defaultSmsRateCents: parseFloat(map.defaultSmsRateCents || "4"),
      defaultMmsRateCents: parseFloat(map.defaultMmsRateCents || "8"),
      defaultPhoneNumberFeeCents: parseInt(map.defaultPhoneNumberFeeCents || "500"),
      minimumCreditsDollars: parseInt(map.minimumCreditsDollars || "5"),
      maxOptOutRatePercent: parseFloat(map.maxOptOutRatePercent || "5"),
      maxFailureRatePercent: parseFloat(map.maxFailureRatePercent || "10"),
      autoSuspendOnHighOptOut: map.autoSuspendOnHighOptOut === "true",
      enforceQuietHours: map.enforceQuietHours !== "false",
      defaultQuietHoursStart: map.defaultQuietHoursStart || "21:00",
      defaultQuietHoursEnd: map.defaultQuietHoursEnd || "08:00",
      adminNotificationEmail: map.adminNotificationEmail || "",
      alertOnNewOrg: map.alertOnNewOrg !== "false",
      alertOnHighOptOut: map.alertOnHighOptOut !== "false",
      alertOnPaymentFailure: map.alertOnPaymentFailure !== "false",
      platformName: map.platformName || "CivicText",
      supportEmail: map.supportEmail || "",
      supportPhone: map.supportPhone || "",
      maintenanceMode: map.maintenanceMode === "true",
    };
  } catch {
    // PlatformSetting table might not exist yet
    return null;
  }
}

export async function updateAdminSettingsAction(settings: AdminSettings) {
  await requireSuperAdmin();

  const validated = settingsSchema.parse(settings);

  const entries = Object.entries(validated).map(([key, value]) => ({
    key,
    value: String(value),
  }));

  // Upsert each setting
  await Promise.all(
    entries.map((entry) =>
      db.platformSetting.upsert({
        where: { key: entry.key },
        create: { key: entry.key, value: entry.value },
        update: { value: entry.value },
      })
    )
  );

  console.info(`[ADMIN] Platform settings updated`);
  return { success: true };
}
