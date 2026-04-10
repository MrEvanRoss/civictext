"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTenantDb } from "@/lib/db-tenant";
import { ROLE_HIERARCHY, ROLE_PERMISSIONS, type Permission } from "@/lib/constants";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { cookies, headers } from "next/headers";

// ---------------------------------------------------------------------------
// CSRF origin validation (defense-in-depth)
// ---------------------------------------------------------------------------
// Next.js 14.2+ performs an Origin-vs-Host check for every server action at
// the framework level (see experimental.serverActions.allowedOrigins in
// next.config.mjs). This utility provides an *additional* application-layer
// check that server actions can call for extra safety — especially useful for
// sensitive mutations (password changes, financial operations, etc.).
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS: string[] = [
  process.env.NEXT_PUBLIC_APP_URL!, // e.g. https://civictext.com
].filter(Boolean);

/**
 * Validate that the incoming request's Origin header matches the app's
 * configured origin.  Throws if the Origin is present and does not match.
 *
 * Call this at the top of any security-sensitive server action as an extra
 * layer on top of the framework-level CSRF check.
 */
export async function validateCsrfOrigin(): Promise<void> {
  const hdrs = await headers();
  const origin = hdrs.get("origin");

  // When there is no Origin header the request came from a same-origin
  // navigation (GET) or a very old browser.  The framework-level check
  // already handles this case, so we allow it through here.
  if (!origin) return;

  const allowed = ALLOWED_ORIGINS.some((allowed) => {
    try {
      return new URL(allowed).origin === new URL(origin).origin;
    } catch {
      return false;
    }
  });

  if (!allowed) {
    throw new Error("Invalid request origin");
  }
}

/**
 * Check if the current session is impersonating another org.
 * Returns the overridden orgId and role if impersonating, or null.
 */
async function getImpersonationState() {
  try {
    const cookieStore = await cookies();
    const impersonateCookie = cookieStore.get("civictext_impersonate");
    if (!impersonateCookie?.value) return null;

    const state = JSON.parse(impersonateCookie.value);
    if (state.targetOrgId && state.targetUserId) {
      // Re-verify the original admin still has superadmin privileges
      const adminUser = await db.user.findUnique({
        where: { id: state.adminId },
        select: { isSuperAdmin: true },
      });
      if (!adminUser?.isSuperAdmin) {
        // Admin privileges were revoked — clear the impersonation cookie
        cookieStore.delete("civictext_impersonate");
        return null;
      }
      return state;
    }
  } catch {
    // Invalid cookie, ignore
  }
  return null;
}

/**
 * Get the current authenticated session or redirect to login.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Get the current session and a tenant-scoped database client.
 * If the super admin is impersonating an org, uses the target orgId instead.
 */
export async function requireOrg() {
  const session = await requireAuth();
  const impersonation = session.user.isSuperAdmin ? await getImpersonationState() : null;

  if (impersonation) {
    // Override the orgId for the duration of this request.
    // Use a typed assertion — these runtime-only fields are added during
    // impersonation and declared in src/types/next-auth.d.ts.
    const user = session.user as typeof session.user & {
      _impersonating: boolean;
      _adminId: string;
    };
    user.orgId = impersonation.targetOrgId;
    user.role = impersonation.targetRole || "OWNER";
    user._impersonating = true;
    user._adminId = impersonation.adminId;
  }

  const tenantDb = getTenantDb(session.user.orgId);
  return { session, tenantDb };
}

/**
 * Check if the current user is impersonating.
 */
export async function getImpersonationInfo() {
  const session = await auth();
  if (!session?.user || !session.user.isSuperAdmin) return null;

  const state = await getImpersonationState();
  if (!state) return null;

  return {
    isImpersonating: true,
    targetOrgId: state.targetOrgId,
    targetOrgName: state.targetOrgName,
    adminId: state.adminId,
  };
}

/**
 * Require that the user has at least the specified role.
 */
export async function requireRole(minRole: UserRole) {
  const session = await requireAuth();
  const userRoleIndex = ROLE_HIERARCHY.indexOf(session.user.role);
  const requiredRoleIndex = ROLE_HIERARCHY.indexOf(minRole);

  if (userRoleIndex < requiredRoleIndex) {
    throw new Error("Insufficient permissions");
  }

  return session;
}

/**
 * Require that the user has a specific permission.
 */
export async function requirePermission(permission: Permission) {
  const session = await requireAuth();
  const userPermissions = ROLE_PERMISSIONS[session.user.role] || [];

  if (!userPermissions.includes(permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }

  return session;
}

/**
 * Require that the user is a platform super admin.
 */
export async function requireSuperAdmin() {
  const session = await requireAuth();
  if (!session.user.isSuperAdmin) {
    redirect("/dashboard");
  }
  return session;
}

/**
 * Register a new user and create their organization.
 */
export async function registerUser(data: {
  email: string;
  password: string;
  name: string;
  orgName: string;
}) {
  const normalizedEmail = data.email.toLowerCase().trim();

  // Check if email already exists
  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new Error("Email already registered");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Create org and user in a transaction
  const result = await db.$transaction(async (tx) => {
    // Create organization (pending approval by default)
    const org = await tx.organization.create({
      data: {
        name: data.orgName,
        slug: data.orgName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        status: "PENDING_APPROVAL",
      },
    });

    // Create user as OWNER
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: data.name,
        orgId: org.id,
        role: "OWNER",
      },
    });

    // Create messaging plan with $0 balance (must prepay)
    await tx.messagingPlan.create({
      data: {
        orgId: org.id,
        balanceCents: 0,
        smsRateCents: 4,
        mmsRateCents: 8,
      },
    });

    return { user, org };
  });

  return result;
}
