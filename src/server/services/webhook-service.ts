import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import crypto from "crypto";

const WEBHOOK_FAIL_THRESHOLD = 10;

/**
 * Atomically increment fail count and disable the endpoint if the
 * threshold is reached — single DB round-trip to avoid read-after-update races.
 */
async function recordWebhookFailure(endpointId: string, errorMessage: string) {
  await db.$executeRaw`
    UPDATE "WebhookEndpoint"
    SET
      "failCount" = "failCount" + 1,
      "lastError" = ${errorMessage},
      "isActive" = CASE WHEN "failCount" + 1 >= ${WEBHOOK_FAIL_THRESHOLD} THEN false ELSE "isActive" END
    WHERE "id" = ${endpointId}
  `;
}

export type WebhookEvent =
  | "message.sent"
  | "message.delivered"
  | "message.failed"
  | "message.inbound"
  | "contact.opted_in"
  | "contact.opted_out"
  | "campaign.completed"
  | "interest_list.joined";

/**
 * Dispatch a webhook event to all registered endpoints for an org.
 * Fire-and-forget: errors are logged but never block the caller.
 *
 * Uses a short setTimeout to defer the HTTP request until after the
 * current call stack completes. This prevents a race condition where
 * the receiving server queries CivicText's API before the database
 * transaction (or sequential writes) that triggered the webhook have
 * committed.
 */
export function dispatchWebhook(
  orgId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
) {
  // Defer dispatch so the caller's remaining DB writes can commit first.
  setTimeout(() => {
    deliverWebhook(orgId, event, payload);
  }, 0);
}

async function deliverWebhook(
  orgId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
) {
  try {
    const endpoints = await db.webhookEndpoint.findMany({
      where: {
        orgId,
        isActive: true,
        events: { has: event },
      },
    });

    if (endpoints.length === 0) return;

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    for (const endpoint of endpoints) {
      // HMAC signature for verification
      const signature = crypto
        .createHmac("sha256", endpoint.secret)
        .update(body)
        .digest("hex");

      // Fire-and-forget with timeout
      fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CivicText-Signature": signature,
          "X-CivicText-Event": event,
        },
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout
      })
        .then(async (res) => {
          if (!res.ok) {
            await recordWebhookFailure(endpoint.id, `HTTP ${res.status}`);
          } else if (endpoint.failCount > 0) {
            await db.webhookEndpoint.update({
              where: { id: endpoint.id },
              data: { failCount: 0, lastError: null },
            });
          }
        })
        .catch(async (err) => {
          try {
            await recordWebhookFailure(
              endpoint.id,
              err instanceof Error ? err.message : "Unknown error"
            );
          } catch (dbErr) {
            logger.error("Failed to update webhook fail count", { endpointId: endpoint.id, error: dbErr instanceof Error ? dbErr.message : String(dbErr) });
          }
        });
    }
  } catch (err) {
    logger.error("Failed to dispatch webhook", { orgId, event, error: err instanceof Error ? err.message : String(err) });
  }
}
