import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Stop impersonation and return to admin view.
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("civictext_impersonate");
  return NextResponse.redirect(new URL("/admin/orgs", request.url));
}
