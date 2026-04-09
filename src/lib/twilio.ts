import Twilio from "twilio";
import { decrypt } from "@/utils/encryption";
import { db } from "./db";

/**
 * Get the master Twilio client (CivicText's main account).
 */
export function getMasterClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }

  return Twilio(accountSid, authToken);
}

/**
 * Get a Twilio client scoped to a specific org's subaccount.
 *
 * IMPORTANT: Callers MUST verify that the requesting user/context has
 * permission to access this orgId before calling. In request contexts,
 * use `requireOrg()` first and pass the session orgId. Worker processes
 * that operate on jobs already scoped to an orgId may call directly.
 *
 * @param orgId - The organization ID (must be pre-authorized)
 * @param callerOrgId - Optional: the authenticated user's orgId for
 *                      cross-org access control. If provided and doesn't
 *                      match orgId, the call is rejected.
 */
export async function getOrgClient(orgId: string, callerOrgId?: string) {
  // C-3: If a callerOrgId is provided, verify it matches the target org
  if (callerOrgId && callerOrgId !== orgId) {
    throw new Error("Access denied: cannot access another organization's Twilio account");
  }

  const subaccount = await db.twilioSubaccount.findUnique({
    where: { orgId },
  });

  if (!subaccount) {
    throw new Error(`No Twilio subaccount found for org ${orgId}`);
  }

  const authToken = decrypt(subaccount.authTokenEncrypted);
  return Twilio(subaccount.accountSid, authToken);
}

/**
 * Validate a Twilio webhook request signature.
 * Returns true if the request is authentic.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("TWILIO_AUTH_TOKEN must be set for webhook validation");
  }

  return Twilio.validateRequest(authToken, signature, url, params);
}
