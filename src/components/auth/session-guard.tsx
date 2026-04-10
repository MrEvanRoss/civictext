"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Periodically validates the session is still active.
 * If the session expires or becomes invalid, forces a logout.
 * Mount this inside SessionProvider on authenticated pages.
 */
export function SessionGuard() {
  const { status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    // Only run on authenticated pages
    const isProtected =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/contacts") ||
      pathname.startsWith("/campaigns") ||
      pathname.startsWith("/inbox") ||
      pathname.startsWith("/analytics") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/billing") ||
      pathname.startsWith("/team") ||
      pathname.startsWith("/templates") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/supervisor") ||
      pathname.startsWith("/interest-lists") ||
      pathname.startsWith("/journeys") ||
      pathname.startsWith("/phone-numbers") ||
      pathname.startsWith("/growth") ||
      pathname.startsWith("/scheduled") ||
      pathname.startsWith("/surveys") ||
      pathname.startsWith("/subcommunities") ||
      pathname.startsWith("/polling-locations");

    if (!isProtected) return;

    if (status === "unauthenticated") {
      signOut({ callbackUrl: "/login" });
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok || res.status === 401) {
          signOut({ callbackUrl: "/login" });
          return;
        }
        const data = await res.json();
        if (!data?.user) {
          signOut({ callbackUrl: "/login" });
        }
      } catch {
        // Network error — don't force logout, will retry next interval
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [status, pathname]);

  return null;
}
