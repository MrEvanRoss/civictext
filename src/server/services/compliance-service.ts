import { db } from "@/lib/db";

/**
 * TCPA/CTIA Compliance Gate
 * Every outbound message passes through these checks before sending.
 */

interface ComplianceCheck {
  allowed: boolean;
  reason?: string;
  action?: "block" | "delay" | "warn";
  delayUntil?: Date;
}

/**
 * Run all compliance checks for an outbound message.
 */
export async function runComplianceChecks(
  orgId: string,
  contactId: string,
  messageBody: string,
  recipientPhone: string
): Promise<ComplianceCheck> {
  // 1. Consent check (most critical)
  const consentResult = await enforceConsent(orgId, contactId);
  if (!consentResult.allowed) return consentResult;

  // 2. Quiet hours check
  const quietResult = isQuietHours(recipientPhone);
  if (!quietResult.allowed) return quietResult;

  // 3. 10DLC compliance
  const dlcResult = await check10DLCCompliance(orgId);
  if (!dlcResult.allowed) return dlcResult;

  // 4. Content filtering
  const contentResult = filterContent(messageBody);
  if (!contentResult.allowed) return contentResult;

  // 5. Political disclaimer
  const disclaimerResult = await validatePoliticalDisclaimer(orgId, messageBody);
  if (!disclaimerResult.allowed) return disclaimerResult;

  return { allowed: true };
}

/**
 * Check 1: Verify contact has valid consent.
 */
async function enforceConsent(
  orgId: string,
  contactId: string
): Promise<ComplianceCheck> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, orgId },
    select: { optInStatus: true },
  });

  if (!contact) {
    return { allowed: false, reason: "Contact not found", action: "block" };
  }

  if (contact.optInStatus !== "OPTED_IN") {
    return {
      allowed: false,
      reason: `Contact consent status is ${contact.optInStatus}`,
      action: "block",
    };
  }

  return { allowed: true };
}

/**
 * Check 2: Quiet hours enforcement (8AM-9PM in recipient timezone).
 * Approximates timezone from phone area code.
 */
export function isQuietHours(recipientPhone: string): ComplianceCheck {
  const tz = getTimezoneFromPhone(recipientPhone);
  const now = new Date();

  // Get current hour in recipient timezone
  const recipientHour = parseInt(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz })
  );

  if (recipientHour < 8 || recipientHour >= 21) {
    // Calculate delay until next 8AM
    const nextSend = new Date(now);
    if (recipientHour >= 21) {
      nextSend.setDate(nextSend.getDate() + 1);
    }
    nextSend.setHours(8, 0, 0, 0);

    return {
      allowed: false,
      reason: "Quiet hours: outside 8AM-9PM in recipient timezone",
      action: "delay",
      delayUntil: nextSend,
    };
  }

  return { allowed: true };
}

/**
 * Check 3: Verify 10DLC registration is approved.
 */
async function check10DLCCompliance(orgId: string): Promise<ComplianceCheck> {
  const [brand, campaign] = await Promise.all([
    db.brandRegistration.findFirst({
      where: { orgId, status: "APPROVED" },
    }),
    db.campaignRegistration.findFirst({
      where: { orgId, status: "APPROVED" },
    }),
  ]);

  // Allow sending in test/development if no registrations exist
  if (process.env.NODE_ENV !== "production") {
    return { allowed: true };
  }

  if (!brand) {
    return {
      allowed: false,
      reason: "Brand registration not approved",
      action: "block",
    };
  }

  if (!campaign) {
    return {
      allowed: false,
      reason: "Campaign registration not approved",
      action: "block",
    };
  }

  return { allowed: true };
}

/**
 * Check 4: Filter content for carrier-banned patterns.
 */
function filterContent(messageBody: string): ComplianceCheck {
  const warnings: string[] = [];

  // ALL CAPS detection (carrier flag)
  const words = messageBody.split(/\s+/);
  const capsWords = words.filter(
    (w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w)
  );
  if (capsWords.length > words.length * 0.5) {
    warnings.push("Excessive ALL CAPS may trigger carrier filtering");
  }

  // Blocked URL shorteners
  const blockedShorteners = [
    "bit.ly",
    "tinyurl.com",
    "goo.gl",
    "t.co",
    "ow.ly",
    "is.gd",
    "buff.ly",
  ];
  const lowerBody = messageBody.toLowerCase();
  for (const shortener of blockedShorteners) {
    if (lowerBody.includes(shortener)) {
      return {
        allowed: false,
        reason: `URL shortener "${shortener}" is blocked by carriers. Use full URLs.`,
        action: "block",
      };
    }
  }

  // Known spam trigger words (simplified)
  const spamTriggers = ["free money", "act now", "limited time", "click here"];
  for (const trigger of spamTriggers) {
    if (lowerBody.includes(trigger)) {
      warnings.push(`Content contains spam trigger phrase: "${trigger}"`);
    }
  }

  if (warnings.length > 0) {
    return { allowed: true, reason: warnings.join("; "), action: "warn" };
  }

  return { allowed: true };
}

/**
 * Check 5: Validate political disclaimer is present.
 */
async function validatePoliticalDisclaimer(
  orgId: string,
  messageBody: string
): Promise<ComplianceCheck> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { politicalDisclaimer: true },
  });

  // Only enforce for orgs with a configured disclaimer
  if (!org?.politicalDisclaimer) {
    return { allowed: true };
  }

  const lower = messageBody.toLowerCase();
  if (!lower.includes("paid for by") && !lower.includes(org.politicalDisclaimer.toLowerCase())) {
    return {
      allowed: false,
      reason: 'Political messages must include "Paid for by" disclaimer',
      action: "block",
    };
  }

  return { allowed: true };
}

/**
 * Ensure opt-out instructions are present. Returns the message with instructions appended if needed.
 */
export function ensureOptOutInstructions(messageBody: string): string {
  const lower = messageBody.toLowerCase();
  if (
    lower.includes("reply stop") ||
    lower.includes("text stop") ||
    lower.includes("opt out")
  ) {
    return messageBody;
  }
  return `${messageBody}\nReply STOP to opt out.`;
}

/**
 * Approximate timezone from US phone area code.
 */
function getTimezoneFromPhone(phone: string): string {
  // Extract area code from E.164 (+1XXXXXXXXXX)
  const digits = phone.replace(/\D/g, "");
  const areaCode = digits.length >= 11 ? digits.substring(1, 4) : digits.substring(0, 3);

  // Simplified area code → timezone mapping (major codes)
  const easternCodes = new Set([
    "201","202","203","212","215","216","239","240","248","267","301","302",
    "305","315","321","347","352","386","407","410","412","413","443","508",
    "516","518","551","561","570","571","585","603","607","609","610","614",
    "617","631","646","703","704","718","732","754","757","772","774","786",
    "802","803","813","828","845","856","860","862","904","908","914","917",
    "919","929","941","954","973","980",
  ]);
  const centralCodes = new Set([
    "205","210","214","217","224","225","228","254","256","262","309","312",
    "314","316","318","319","320","331","334","337","361","402","405","409",
    "414","417","423","430","432","469","478","479","484","501","502","504",
    "507","512","513","515","563","573","601","615","618","630","636","651",
    "662","682","708","713","715","731","762","763","769","773","779","785",
    "806","812","815","816","817","830","832","847","850","870","901","903",
    "913","918","920","936","940","952","956","972","979","985",
  ]);
  const mountainCodes = new Set([
    "208","303","385","406","435","480","505","520","575","602","623","720",
    "801","928",
  ]);
  const pacificCodes = new Set([
    "206","209","213","253","310","323","360","408","415","424","425","442",
    "503","509","510","530","541","559","562","619","626","650","657","661",
    "669","702","707","714","725","747","760","775","805","818","831","858",
    "909","916","925","949","951","971",
  ]);

  if (easternCodes.has(areaCode)) return "America/New_York";
  if (centralCodes.has(areaCode)) return "America/Chicago";
  if (mountainCodes.has(areaCode)) return "America/Denver";
  if (pacificCodes.has(areaCode)) return "America/Los_Angeles";

  // Default to Eastern (most conservative)
  return "America/New_York";
}
