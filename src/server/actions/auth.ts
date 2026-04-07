"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTenantDb, type TenantDb } from "@/lib/db-tenant";
import { ROLE_HIERARCHY, ROLE_PERMISSIONS, type Permission } from "@/lib/constants";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";

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
 */
export async function requireOrg() {
  const session = await requireAuth();
  const tenantDb = getTenantDb((session.user as any).orgId);
  return { session, tenantDb };
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

    // Create messaging plan with 0 messages (must prepay)
    await tx.messagingPlan.create({
      data: {
        orgId: org.id,
        tier: "STARTER",
        monthlyAllotment: 0,
      },
    });

    return { user, org };
  });

  return result;
}
