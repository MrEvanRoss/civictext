import { recordClick } from "@/server/services/link-tracking-service";
import { NextResponse } from "next/server";

/**
 * Redirect handler for tracked short links.
 * GET /r/[code] → records click → 302 redirect to original URL.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  const link = await recordClick(code, ip, userAgent);

  if (!link) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(link.originalUrl);
}
