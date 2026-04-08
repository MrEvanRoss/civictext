import { db } from "@/lib/db";
import crypto from "crypto";

/**
 * Generate a short, unique code for link tracking.
 */
function generateShortCode(): string {
  return crypto.randomBytes(4).toString("base64url"); // 6 chars
}

/**
 * Create a tracked link and return the short URL.
 */
export async function createTrackedLink(
  orgId: string,
  originalUrl: string,
  campaignId?: string
): Promise<{ shortCode: string; shortUrl: string }> {
  // Try up to 5 times for a unique code
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = generateShortCode();
    try {
      await db.trackedLink.create({
        data: {
          orgId,
          campaignId,
          shortCode,
          originalUrl,
        },
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return {
        shortCode,
        shortUrl: `${baseUrl}/r/${shortCode}`,
      };
    } catch (err: any) {
      if (err.code === "P2002") continue; // Unique constraint, retry
      throw err;
    }
  }
  throw new Error("Failed to generate unique short code");
}

/**
 * Record a click on a tracked link.
 */
export async function recordClick(
  shortCode: string,
  ip?: string,
  userAgent?: string,
  contactId?: string
) {
  const link = await db.trackedLink.findUnique({
    where: { shortCode },
  });

  if (!link) return null;

  await db.$transaction([
    db.linkClick.create({
      data: {
        trackedLinkId: link.id,
        contactId,
        ip,
        userAgent,
      },
    }),
    db.trackedLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    }),
  ]);

  return link;
}

/**
 * Match URLs in message text — handles https://, http://, www., and bare
 * domains with common TLDs (e.g. google.com, example.org/path).
 */
const URL_REGEX =
  /(?:https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:com|org|net|gov|edu|io|co|us|info|biz|me|app|dev|xyz|tv|ai|news|site|store|tech|online|shop|club|pro|page|link)(?:\/[^\s]*)?)/gi;

/**
 * Normalise a matched URL so the tracked link stores a full URL and the
 * redirect actually works.
 */
function ensureProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

/**
 * Replace URLs in a message body with tracked short links.
 */
export async function shortenLinksInMessage(
  orgId: string,
  messageBody: string,
  campaignId?: string
): Promise<string> {
  const urls = messageBody.match(URL_REGEX);

  if (!urls || urls.length === 0) return messageBody;

  let result = messageBody;
  for (const url of urls) {
    const fullUrl = ensureProtocol(url);
    const { shortUrl } = await createTrackedLink(orgId, fullUrl, campaignId);
    result = result.replace(url, shortUrl);
  }

  return result;
}

/**
 * Get click stats for a campaign's tracked links.
 */
export async function getCampaignLinkStats(orgId: string, campaignId: string) {
  return db.trackedLink.findMany({
    where: { orgId, campaignId },
    include: {
      _count: { select: { clicks: true } },
    },
    orderBy: { clickCount: "desc" },
  });
}
