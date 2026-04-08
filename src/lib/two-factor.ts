import * as OTPAuth from "otpauth";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const APP_NAME = "CivicText";

/**
 * Generate a new TOTP secret for a user.
 * Returns the secret (base32) and an otpauth:// URI for QR code generation.
 */
export function generateTOTPSecret(userEmail: string) {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: userEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  return {
    secret: secret.base32,
    uri: totp.toString(),
  };
}

/**
 * Verify a TOTP code against a secret.
 * Allows a +-1 time window (30s each side) for clock drift.
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // delta will be null if invalid, or a number (-1, 0, 1) indicating the time step
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

/**
 * Generate 10 backup codes (8 characters each, alphanumeric).
 * Returns both plaintext (to display to user) and hashed (to store in DB).
 */
export async function generateBackupCodes(): Promise<{
  plaintext: string[];
  hashed: string[];
}> {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    // Generate 4 random bytes -> 8 hex chars, formatted as XXXX-XXXX
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }

  const hashed = await Promise.all(
    codes.map((code) => bcrypt.hash(code.replace("-", ""), 10))
  );

  return { plaintext: codes, hashed };
}

/**
 * Verify a backup code against the stored hashed codes.
 * Returns the index of the matching code (to remove it), or -1 if no match.
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<number> {
  const normalized = code.replace("-", "").toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(normalized, hashedCodes[i]);
    if (match) return i;
  }
  return -1;
}
