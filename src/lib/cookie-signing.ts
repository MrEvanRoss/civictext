import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for cookie signing");
  return secret;
}

/**
 * Sign a JSON payload with HMAC-SHA256.
 * Returns "base64(payload).base64(signature)".
 */
export function signCookieValue(payload: object): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString("base64");
  const sig = createHmac("sha256", getSecret()).update(data).digest("base64");
  return `${data}.${sig}`;
}

/**
 * Verify and parse a signed cookie value.
 * Returns the parsed payload or null if the signature is invalid.
 */
export function verifyCookieValue<T = unknown>(raw: string): T | null {
  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const data = raw.slice(0, dotIndex);
  const sig = raw.slice(dotIndex + 1);

  const expected = createHmac("sha256", getSecret()).update(data).digest("base64");

  // Timing-safe comparison to prevent timing attacks
  try {
    const sigBuf = Buffer.from(sig, "base64");
    const expectedBuf = Buffer.from(expected, "base64");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(data, "base64").toString("utf-8")) as T;
  } catch {
    return null;
  }
}
