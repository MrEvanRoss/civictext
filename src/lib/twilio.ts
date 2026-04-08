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
 */
export async function getOrgClient(orgId: string) {
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
