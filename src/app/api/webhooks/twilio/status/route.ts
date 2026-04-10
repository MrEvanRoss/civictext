import { NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/twilio";
import { db } from "@/lib/db";
import { dispatchWebhook, type WebhookEvent } from "@/server/services/webhook-service";

/**
 * Twilio Delivery Status Webhook
 * Called by Twilio when a message status changes:
 * queued -> sent -> delivered / failed / undelivered
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  // Parse form data (Twilio sends application/x-www-form-urlencoded)
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  // Validate Twilio signature
  const signature = request.headers.get("x-twilio-signature") || "";
  const requestUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/status?orgId=${orgId}`;

  if (process.env.NODE_ENV === "production") {
    const isValid = validateTwilioSignature(requestUrl, params, signature);
    if (!isValid) {
      console.error("Invalid Twilio signature on status webhook");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  // Validate that the phone number belongs to the claimed org
  // to prevent cross-org data injection via crafted orgId query params
  const to = params.To;
  if (to) {
    const phoneNumber = await db.phoneNumber.findFirst({
      where: { orgId, phoneNumber: to },
    });
    if (!phoneNumber) {
      console.error(`Phone number ${to} does not belong to org ${orgId}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const messageSid = params.MessageSid;
  const messageStatus = params.MessageStatus;
  const errorCode = params.ErrorCode;

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Map Twilio status to our MessageStatus enum
  const statusMap: Record<string, string> = {
    queued: "QUEUED",
    sending: "SENDING",
    sent: "SENT",
    delivered: "DELIVERED",
    failed: "FAILED",
    undelivered: "UNDELIVERED",
  };

  const status = statusMap[messageStatus.toLowerCase()];
  if (!status) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }

  try {
    // Update message record
    const updateData: Record<string, unknown> = { status };
    if (status === "SENT") {
      updateData.sentAt = new Date();
    }
    if (status === "DELIVERED") {
      updateData.deliveredAt = new Date();
    }
    if (errorCode) {
      updateData.errorCode = errorCode;
    }

    // Wrap message update + campaign counter in a transaction to keep
    // counters consistent even if the process crashes mid-operation.
    await db.$transaction(async (tx) => {
      const message = await tx.message.updateMany({
        where: { twilioSid: messageSid, orgId },
        data: updateData,
      });

      if (message.count > 0) {
        const msg = await tx.message.findFirst({
          where: { twilioSid: messageSid, orgId },
          select: { campaignId: true },
        });

        if (msg?.campaignId) {
          const incrementField =
            status === "DELIVERED"
              ? "deliveredCount"
              : status === "FAILED" || status === "UNDELIVERED"
                ? "failedCount"
                : null;

          if (incrementField) {
            await tx.campaign.update({
              where: { id: msg.campaignId },
              data: { [incrementField]: { increment: 1 } },
            });
          }
        }
      }
    });

    // Fire webhook events AFTER all DB writes have completed so the
    // receiving server sees consistent data when it queries back.
    if (status === "DELIVERED" || status === "SENT" || status === "FAILED" || status === "UNDELIVERED") {
      const eventName: WebhookEvent = status === "DELIVERED" ? "message.delivered"
        : status === "SENT" ? "message.sent"
        : "message.failed";
      dispatchWebhook(orgId, eventName, {
        messageSid,
        status,
        errorCode: errorCode || null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing status webhook:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
