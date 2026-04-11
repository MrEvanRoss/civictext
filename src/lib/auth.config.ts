import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";

/**
 * Validate impersonation cookie structure and expiry (edge-safe, no DB, no HMAC).
 *
 * This runs in Edge Runtime (middleware) where Node.js crypto may not be fully
 * available. We only check basic structure and TTL here. Full HMAC signature
 * verification + admin privilege re-check happens server-side in requireOrg().
 *
 * IMPORTANT: Do NOT delete the cookie on failure — let server-side code handle
 * that. Deleting here would break impersonation if Edge crypto is unavailable.
 */
async function validateImpersonationCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get("civictext_impersonate");
    if (!cookie?.value) return true; // No cookie → nothing to validate

    // Parse the base64 payload without HMAC verification (edge-safe)
    const dotIndex = cookie.value.lastIndexOf(".");
    if (dotIndex === -1) return false; // Malformed — but don't delete

    const data = cookie.value.slice(0, dotIndex);
    let state: Record<string, string>;
    try {
      const json = Buffer.from(data, "base64").toString("utf-8");
      state = JSON.parse(json);
    } catch {
      return false; // Can't parse — but don't delete
    }

    // Basic structure check
    if (!state.adminId || !state.targetOrgId || !state.targetUserId || !state.startedAt) {
      return false;
    }

    // Enforce 2-hour TTL (defense-in-depth alongside cookie maxAge)
    const startedAt = new Date(state.startedAt).getTime();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    if (Date.now() - startedAt > TWO_HOURS_MS) {
      // TTL expired — safe to delete since this is clearly stale
      cookieStore.delete("civictext_impersonate");
      return false;
    }

    return true;
  } catch {
    // Don't delete the cookie on unexpected errors — let server-side handle it
    return false;
  }
}

/**
 * Edge-safe auth config (no database adapter).
 * Used by middleware for route protection.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.orgId = user.orgId;
        token.role = user.role;
        token.isSuperAdmin = user.isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.orgId = token.orgId;
        session.user.role = token.role as UserRole;
        session.user.isSuperAdmin = token.isSuperAdmin;
      }
      return session;
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");
      const isDashboard = nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/contacts") ||
        nextUrl.pathname.startsWith("/campaigns") ||
        nextUrl.pathname.startsWith("/inbox") ||
        nextUrl.pathname.startsWith("/analytics") ||
        nextUrl.pathname.startsWith("/phone-numbers") ||
        nextUrl.pathname.startsWith("/billing") ||
        nextUrl.pathname.startsWith("/settings") ||
        nextUrl.pathname.startsWith("/growth") ||
        nextUrl.pathname.startsWith("/team") ||
        nextUrl.pathname.startsWith("/templates") ||
        nextUrl.pathname.startsWith("/surveys") ||
        nextUrl.pathname.startsWith("/subcommunities") ||
        nextUrl.pathname.startsWith("/journeys") ||
        nextUrl.pathname.startsWith("/scheduled") ||
        nextUrl.pathname.startsWith("/supervisor") ||
        nextUrl.pathname.startsWith("/interest-lists") ||
        nextUrl.pathname.startsWith("/polling-locations");
      const isAdmin = nextUrl.pathname.startsWith("/admin");
      const isWebhook = nextUrl.pathname.startsWith("/api/webhooks");

      // Webhooks are always public (validated by signature)
      if (isWebhook) return true;

      // Redirect logged-in users away from auth pages
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // Require auth for dashboard and admin routes
      if ((isDashboard || isAdmin) && !isLoggedIn) {
        return false; // Redirects to signIn page
      }

      // Admin routes require superAdmin (checked in server components/actions)
      if (isAdmin && isLoggedIn) {
        const isSuperAdmin = auth?.user?.isSuperAdmin;
        if (!isSuperAdmin) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }

      // M-2: Validate impersonation cookie structure/expiry on every request
      if (isLoggedIn && (isDashboard || isAdmin)) {
        await validateImpersonationCookie();
      }

      return true;
    },
  },
  providers: [], // Configured in auth.ts
};
