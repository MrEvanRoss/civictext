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
 * Replace URLs in a message body with tracked short links.
 */
export async function shortenLinksInMessage(
  orgId: string,
  messageBody: string,
  campaignId?: string
): Promise<string> {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = messageBody.match(urlRegex);

  if (!urls || urls.length === 0) return messageBody;

  let result = messageBody;
  for (const url of urls) {
    const { shortUrl } = await createTrackedLink(orgId, url, campaignId);
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
