import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

/**
 * Admin impersonation endpoint.
 * Sets a special cookie that overrides the session's orgId/role
 * so the super admin can browse the platform as a client.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !(session.user as any).isSuperAdmin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const orgId = url.searchParams.get("orgId");

  if (!userId || !orgId) {
    return NextResponse.json({ error: "Missing userId or orgId" }, { status: 400 });
  }

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
  cookieStore.set("civictext_impersonate", JSON.stringify({
    adminId: (session.user as any).id,
    adminOrgId: (session.user as any).orgId,
    targetUserId: targetUser.id,
    targetOrgId: targetUser.orgId,
    targetRole: targetUser.role,
    startedAt: new Date().toISOString(),
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 2, // 2 hours
    path: "/",
  });

  // Redirect to the client's dashboard
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
