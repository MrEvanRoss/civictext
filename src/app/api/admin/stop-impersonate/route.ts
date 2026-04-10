import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Stop impersonation and return to admin view.
 * Requires an authenticated super-admin session.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !session.user.isSuperAdmin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieStore = await cookies();
  cookieStore.delete("civictext_impersonate");
  return NextResponse.redirect(new URL("/admin/orgs", request.url));
}
