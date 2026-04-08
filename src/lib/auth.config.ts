import type { NextAuthConfig } from "next-auth";

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
        token.orgId = (user as any).orgId;
        token.role = (user as any).role;
        token.isSuperAdmin = (user as any).isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).orgId = token.orgId;
        (session.user as any).role = token.role;
        (session.user as any).isSuperAdmin = token.isSuperAdmin;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
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
        nextUrl.pathname.startsWith("/flows") ||
        nextUrl.pathname.startsWith("/scheduled") ||
        nextUrl.pathname.startsWith("/supervisor") ||
        nextUrl.pathname.startsWith("/interest-lists");
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

      return true;
    },
  },
  providers: [], // Configured in auth.ts
};
