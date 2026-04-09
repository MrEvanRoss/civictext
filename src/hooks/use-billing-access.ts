"use client";

import { useSession } from "next-auth/react";

/**
 * Returns true if the current user has OWNER or ADMIN role — the only roles
 * permitted to see message costs, balances, and billing information.
 */
export function useBillingAccess(): boolean {
  const { data: session } = useSession();
  const role = session?.user?.role;
  return role === "OWNER" || role === "ADMIN";
}
