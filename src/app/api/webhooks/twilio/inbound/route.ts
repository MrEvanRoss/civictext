import { NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/twilio";
import { db } from "@/lib/db";
import { OPT_OUT_KEYWORDS, OPT_IN_KEYWORDS } from "@/lib/constants";
import { dispatchWebhook } from "@/server/services/webhook-service";

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

  // Validate that the receiving phone number belongs to the claimed org
  // to prevent cross-org data injection via crafted orgId query params
  if (to) {
    const phoneNumber = await db.phoneNumber.findFirst({
      where: { orgId, phoneNumber: to },
    });
    if (!phoneNumber) {
      console.error(`Phone number ${to} does not belong to org ${orgId}`);
      return new Response(twiml(""), {
        status: 403,
        headers: { "Content-Type": "text/xml" },
      });
    }
  }

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

      // Fire webhook (non-blocking)
      dispatchWebhook(orgId, "contact.opted_out", { phone: from, keyword: normalizedBody });

      return new Response(
        twiml("You have been unsubscribed. You will not receive any more messages. Reply START to re-subscribe."),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // === OPT-IN CHECK ===
    if (OPT_IN_KEYWORDS.includes(normalizedBody)) {
      // Check if this is a double opt-in confirmation (contact is PENDING)
      const pendingContact = await db.contact.findFirst({
        where: { orgId, phone: from, optInStatus: "PENDING" },
      });

      await processOptIn(orgId, from);

      // Fire webhook (non-blocking)
      dispatchWebhook(orgId, "contact.opted_in", { phone: from, keyword: normalizedBody, doubleOptIn: !!pendingContact });

      if (pendingContact) {
        return new Response(
          twiml("Your subscription is confirmed! You will now receive messages. Reply STOP to unsubscribe."),
          { headers: { "Content-Type": "text/xml" } }
        );
      }

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
    const inboundMessage = await db.message.create({
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

    // Create or update conversation
    await db.conversation.upsert({
      where: { orgId_contactId: { orgId, contactId: contact.id } },
      create: {
        orgId,
        contactId: contact.id,
        lastMessageAt: new Date(),
      },
      update: {
        lastMessageAt: new Date(),
        state: "OPEN",
      },
    });

    // Fire webhook (non-blocking)
    dispatchWebhook(orgId, "message.inbound", {
      messageId: inboundMessage.id,
      contactId: contact.id,
      phone: from,
      body,
      mediaUrl,
    });

    // === INTEREST LIST KEYWORD CHECK ===
    const interestList = await db.interestList.findFirst({
      where: {
        orgId,
        keyword: normalizedBody,
        isActive: true,
      },
    });

    if (interestList) {
      // Add contact to interest list (skip if already a member)
      const existingMember = await db.interestListMember.findFirst({
        where: { interestListId: interestList.id, contactId: contact.id },
      });

      if (!existingMember) {
        await db.interestListMember.create({
          data: {
            interestListId: interestList.id,
            contactId: contact.id,
            source: "keyword",
          },
        });

        await db.interestList.update({
          where: { id: interestList.id },
          data: { memberCount: { increment: 1 } },
        });

        // Fire webhook (non-blocking)
        dispatchWebhook(orgId, "interest_list.joined", {
          contactId: contact.id,
          phone: from,
          listId: interestList.id,
          listName: interestList.name,
          keyword: interestList.keyword,
        });
      }

      // Auto opt-in the contact if they're texting a keyword to join
      if (contact.optInStatus !== "OPTED_IN") {
        await db.contact.update({
          where: { id: contact.id },
          data: {
            optInStatus: "OPTED_IN",
            optInTimestamp: new Date(),
            optInSource: `interest_list:${interestList.keyword}`,
          },
        });

        await db.consentAuditLog.create({
          data: {
            orgId,
            contactId: contact.id,
            action: "OPTED_IN",
            source: "interest_list_keyword",
            metadata: { keyword: interestList.keyword, listName: interestList.name },
          },
        });
      }

      // Send welcome message if configured
      if (interestList.welcomeMessage) {
        return new Response(twiml(interestList.welcomeMessage), {
          headers: { "Content-Type": "text/xml" },
        });
      }

      return new Response(
        twiml(`You've been added to ${interestList.name}! Reply STOP to opt out.`),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // === P2P REPLY DETECTION ===
    // If this contact has any SENT P2P assignments, mark them as REPLIED
    const p2pAssignments = await db.p2PAssignment.findMany({
      where: {
        orgId,
        contactId: contact.id,
        status: "SENT",
      },
      select: { id: true, campaignId: true },
    }) as Array<{ id: string; campaignId: string }>;

    if (p2pAssignments.length > 0) {
      await db.p2PAssignment.updateMany({
        where: {
          id: { in: p2pAssignments.map((a: { id: string }) => a.id) },
        },
        data: { status: "REPLIED" },
      });

      // Increment response count on each affected campaign
      const campaignIds = Array.from(new Set(p2pAssignments.map((a: { campaignId: string }) => a.campaignId)));
      for (const cId of campaignIds) {
        await db.campaign.update({
          where: { id: cId },
          data: { responseCount: { increment: 1 } },
        });
      }
    }

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

    // Mark any pending P2P assignments as OPTED_OUT
    await db.p2PAssignment.updateMany({
      where: {
        orgId,
        contactId: contact.id,
        status: "PENDING",
      },
      data: { status: "OPTED_OUT", skippedAt: now },
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
