"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  generateTOTPSecret,
  verifyTOTPCode,
  generateBackupCodes,
} from "@/lib/two-factor";
import { requireAuth } from "./auth";
import QRCode from "qrcode";

/**
 * Pre-authenticate: verify email + password without signing in.
 * Returns whether 2FA is required for this user.
 * Called from the login page before signIn().
 */
export async function preAuthenticateAction(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      passwordHash: true,
      twoFactorEnabled: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user || !user.passwordHash) {
    return { valid: false, requiresTwoFactor: false, mustSetup2FA: false };
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return { valid: false, requiresTwoFactor: false, mustSetup2FA: false };
  }

  // Check if the platform requires 2FA for this user's role
  let mustSetup2FA = false;
  if (!user.twoFactorEnabled) {
    try {
      const roleKey = `require2FAFor${user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()}s`;
      const [setting, graceSetting] = await Promise.all([
        db.platformSetting.findUnique({ where: { key: roleKey } }),
        db.platformSetting.findUnique({ where: { key: "require2FAGracePeriodDays" } }),
      ]);

      if (setting?.value === "true") {
        const graceDays = parseInt(graceSetting?.value || "7");
        if (graceDays === 0) {
          // Immediate enforcement
          mustSetup2FA = true;
        } else {
          // Check if grace period has expired since the setting was last updated
          const graceDeadline = new Date(setting.updatedAt);
          graceDeadline.setDate(graceDeadline.getDate() + graceDays);
          if (new Date() > graceDeadline) {
            mustSetup2FA = true;
          }
        }
      }
    } catch {
      // PlatformSetting table might not exist yet — don't block login
    }
  }

  return {
    valid: true,
    requiresTwoFactor: user.twoFactorEnabled,
    mustSetup2FA,
  };
}

/**
 * Begin 2FA setup: generate a new TOTP secret and QR code.
 * The secret is NOT saved to the user yet — it's returned for display.
 * The user must verify a code before we persist it.
 */
export async function beginTwoFactorSetupAction() {
  const session = await requireAuth();
  const user = session.user as any;

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, twoFactorEnabled: true },
  });
  if (!dbUser) throw new Error("User not found");
  if (dbUser.twoFactorEnabled) throw new Error("2FA is already enabled");

  const { secret, uri } = generateTOTPSecret(dbUser.email);

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(uri, {
    width: 256,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return { secret, uri, qrCodeDataUrl };
}

/**
 * Confirm 2FA setup: verify the TOTP code the user entered, then persist the secret.
 * Returns backup codes (plaintext) for the user to save.
 */
export async function confirmTwoFactorSetupAction(
  secret: string,
  code: string
) {
  const session = await requireAuth();
  const user = session.user as any;

  // Verify the code against the provided secret
  const isValid = verifyTOTPCode(secret, code);
  if (!isValid) {
    throw new Error("Invalid verification code. Please try again.");
  }

  // Generate backup codes
  const { plaintext, hashed } = await generateBackupCodes();

  // Save to DB
  await db.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: hashed,
    },
  });

  return { backupCodes: plaintext };
}

/**
 * Disable 2FA. Requires the user's password for security.
 */
export async function disableTwoFactorAction(password: string) {
  const session = await requireAuth();
  const user = session.user as any;

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, twoFactorEnabled: true },
  });
  if (!dbUser) throw new Error("User not found");
  if (!dbUser.twoFactorEnabled) throw new Error("2FA is not enabled");
  if (!dbUser.passwordHash) throw new Error("No password set");

  const isValid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!isValid) throw new Error("Incorrect password");

  await db.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });

  return { disabled: true };
}

/**
 * Regenerate backup codes. Requires the user's password.
 * Returns new plaintext codes and saves hashed versions.
 */
export async function regenerateBackupCodesAction(password: string) {
  const session = await requireAuth();
  const user = session.user as any;

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, twoFactorEnabled: true },
  });
  if (!dbUser) throw new Error("User not found");
  if (!dbUser.twoFactorEnabled) throw new Error("2FA is not enabled");
  if (!dbUser.passwordHash) throw new Error("No password set");

  const isValid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!isValid) throw new Error("Incorrect password");

  const { plaintext, hashed } = await generateBackupCodes();

  await db.user.update({
    where: { id: user.id },
    data: { twoFactorBackupCodes: hashed },
  });

  return { backupCodes: plaintext };
}

/**
 * Check current 2FA status for the logged-in user.
 */
export async function getTwoFactorStatusAction() {
  const session = await requireAuth();
  const user = session.user as any;

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: true,
    },
  });

  return {
    enabled: dbUser?.twoFactorEnabled ?? false,
    backupCodesRemaining: dbUser?.twoFactorBackupCodes?.length ?? 0,
  };
}
