"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTenantDb, type TenantDb } from "@/lib/db-tenant";
import { ROLE_HIERARCHY, ROLE_PERMISSIONS, type Permission } from "@/lib/constants";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";

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
  const impersonation = (session.user as any).isSuperAdmin ? await getImpersonationState() : null;

  if (impersonation) {
    // Override the orgId for the duration of this request
    (session.user as any).orgId = impersonation.targetOrgId;
    (session.user as any).role = impersonation.targetRole || "OWNER";
    (session.user as any)._impersonating = true;
    (session.user as any)._adminId = impersonation.adminId;
  }

  const tenantDb = getTenantDb((session.user as any).orgId);
  return { session, tenantDb };
}

/**
 * Check if the current user is impersonating.
 */
export async function getImpersonationInfo() {
  const session = await auth();
  if (!session?.user || !(session.user as any).isSuperAdmin) return null;

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
  const userRoleIndex = ROLE_HIERARCHY.indexOf((session.user as any).role);
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
  const userPermissions = ROLE_PERMISSIONS[(session.user as any).role] || [];

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
  if (!(session.user as any).isSuperAdmin) {
    redirect("/dashboard");
  }
  return session;
}

/**
 * Check if a role has a specific permission (client-safe, no DB call).
 */
export async function hasPermission(role: UserRole, permission: Permission): Promise<boolean> {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return rolePermissions.includes(permission);
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
  // Check if email already exists
  const existing = await db.user.findUnique({
    where: { email: data.email },
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
        email: data.email,
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
