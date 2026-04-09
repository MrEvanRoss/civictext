import { NextResponse } from "next/server";

/**
 * Allowed origins for CSRF validation on API routes.
 *
 * Next.js server actions already validate Origin vs Host at the framework
 * level, but API routes (route handlers) don't get that protection
 * automatically. This utility provides Origin-header checking for POST/PUT/
 * DELETE API routes that handle mutations.
 */
const ALLOWED_ORIGINS: string[] = [
  process.env.NEXT_PUBLIC_APP_URL!,
  // In development, also allow localhost variants
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : []),
].filter(Boolean);

/**
 * Validate the Origin header of an incoming API request.
 * Returns a NextResponse (403) if the origin is invalid, or null if the
 * request is allowed.
 *
 * Usage in route handlers:
 *   const csrfError = await validateApiCsrf(request);
 *   if (csrfError) return csrfError;
 */
export async function validateApiCsrf(
  request: Request
): Promise<NextResponse | null> {
  const origin = request.headers.get("origin");

  // No Origin header → same-origin navigation or very old browser.
  // These are also protected by the auth check that follows.
  if (!origin) return null;

  const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
    try {
      return new URL(allowed).origin === new URL(origin).origin;
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  return null;
}
