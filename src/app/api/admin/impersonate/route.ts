import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { signCookieValue } from "@/lib/cookie-signing";

/**
 * Admin impersonation endpoint.
 * Sets a special cookie that overrides the session's orgId/role
 * so the super admin can browse the platform as a client.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !session.user.isSuperAdmin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Rate limit: 5 impersonations per 5 minutes per admin user
  const adminId = session.user.id;
  const { allowed } = await rateLimit(`rl:impersonate:${adminId}`, 5, 300);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many impersonation attempts. Please wait before trying again." },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const rawUserId = url.searchParams.get("userId");
  const rawOrgId = url.searchParams.get("orgId");

  if (!rawUserId || !rawOrgId) {
    return NextResponse.json({ error: "Missing userId or orgId" }, { status: 400 });
  }

  // Validate UUID format to prevent injection
  const uuidSchema = z.string().uuid();
  const userIdResult = uuidSchema.safeParse(rawUserId);
  const orgIdResult = uuidSchema.safeParse(rawOrgId);
  if (!userIdResult.success || !orgIdResult.success) {
    return NextResponse.json({ error: "Invalid userId or orgId format" }, { status: 400 });
  }
  const userId = userIdResult.data;
  const orgId = orgIdResult.data;

  // Verify the target user exists and belongs to the org
  const targetUser = await db.user.findFirst({
    where: { id: userId, orgId },
    select: { id: true, name: true, email: true, role: true, orgId: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Store the impersonation state in a cookie
  const cookieStore = await cookies();
  cookieStore.set("civictext_impersonate", signCookieValue({
    adminId: session.user.id,
    adminOrgId: session.user.orgId,
    targetUserId: targetUser.id,
    targetOrgId: targetUser.orgId,
    targetRole: targetUser.role,
    startedAt: new Date().toISOString(),
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 2, // 2 hours
    path: "/",
  });

  // Redirect to the client's dashboard
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
