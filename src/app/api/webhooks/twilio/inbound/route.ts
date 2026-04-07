import { NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/twilio";
import { db } from "@/lib/db";
import { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } from "@/lib/constants";

/**
 * Twilio Inbound Message Webhook
 * Called when a contact sends a text to one of our numbers.
 * Processes opt-out keywords FIRST for TCPA compliance (<1 second).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    return new Response(twiml("Error: missing org"), {
      status: 400,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Parse form data
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  // Validate Twilio signature in production
  const signature = request.headers.get("x-twilio-signature") || "";
  const requestUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/inbound?orgId=${orgId}`;

  if (process.env.NODE_ENV === "production") {
    const isValid = validateTwilioSignature(requestUrl, params, signature);
    if (!isValid) {
      console.error("Invalid Twilio signature on inbound webhook");
      return new Response(twiml(""), {
        status: 403,
        headers: { "Content-Type": "text/xml" },
      });
    }
  }

  const from = params.From; // Contact's phone number
  const to = params.To; // Our phone number
  const body = (params.Body || "").trim();
  const messageSid = params.MessageSid;
  const mediaUrl = params.MediaUrl0;

  if (!from || !body) {
    return new Response(twiml(""), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const normalizedBody = body.toUpperCase().trim();

  try {
    // === OPT-OUT CHECK (must process within 1 second per TCPA) ===
    if (OPT_OUT_KEYWORDS.includes(normalizedBody)) {
      await processOptOut(orgId, from);

      return new Response(
        twiml("You have been unsubscribed. You will not receive any more messages. Reply START to re-subscribe."),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // === OPT-IN CHECK ===
    if (OPT_IN_KEYWORDS.includes(normalizedBody)) {
      await processOptIn(orgId, from);

      return new Response(
        twiml("You have been re-subscribed. Reply STOP to unsubscribe at any time."),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // === REGULAR INBOUND MESSAGE ===
    // Find or create contact
    let contact = await db.contact.findFirst({
      where: { orgId, phone: from },
    });

    if (!contact) {
      contact = await db.contact.create({
        data: {
          orgId,
          phone: from,
          optInStatus: "PENDING",
          optInSource: "inbound_text",
        },
      });
    }

    // Create inbound message record
    await db.message.create({
      data: {
        orgId,
        contactId: contact.id,
        direction: "INBOUND",
        body,
        mediaUrl,
        twilioSid: messageSid,
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });

    // Update contact's last message time
    await db.contact.update({
      where: { id: contact.id },
      data: { lastMessageAt: new Date() },
    });

    // Check auto-reply rules
    const autoReply = await db.autoReplyRule.findFirst({
      where: {
        orgId,
        isActive: true,
        keywords: { has: normalizedBody },
      },
      orderBy: { priority: "desc" },
    });

    if (autoReply) {
      // TODO: Queue the auto-reply via BullMQ (Phase 4)
      return new Response(twiml(autoReply.replyBody), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // TODO: Publish SSE event for inbox real-time updates (Phase 7)

    // No auto-reply; return empty TwiML
    return new Response(twiml(""), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error processing inbound message:", error);
    return new Response(twiml(""), {
      status: 500,
      headers: { "Content-Type": "text/xml" },
    });
  }
}

/**
 * Process opt-out: update contact status immediately.
 */
async function processOptOut(orgId: string, phone: string) {
  const now = new Date();

  // Update contact
  await db.contact.updateMany({
    where: { orgId, phone },
    data: {
      optInStatus: "OPTED_OUT",
      optOutTimestamp: now,
    },
  });

  // Find contact for audit log
  const contact = await db.contact.findFirst({
    where: { orgId, phone },
  });

  if (contact) {
    await db.consentAuditLog.create({
      data: {
        orgId,
        contactId: contact.id,
        action: "OPTED_OUT",
        source: "keyword",
        metadata: { keyword: "STOP", phone },
      },
    });
  }
}

/**
 * Process opt-in: re-subscribe a contact.
 */
async function processOptIn(orgId: string, phone: string) {
  const now = new Date();

  await db.contact.updateMany({
    where: { orgId, phone },
    data: {
      optInStatus: "OPTED_IN",
      optInTimestamp: now,
      optInSource: "keyword",
    },
  });

  const contact = await db.contact.findFirst({
    where: { orgId, phone },
  });

  if (contact) {
    await db.consentAuditLog.create({
      data: {
        orgId,
        contactId: contact.id,
        action: "OPTED_IN",
        source: "keyword",
        metadata: { keyword: "START", phone },
      },
    });
  }
}

/**
 * Generate TwiML response.
 */
function twiml(message: string): string {
  if (!message) {
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
