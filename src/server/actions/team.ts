"use server";

import { requireOrg, requirePermission, requireSuperAdmin } from "./auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { ROLE_HIERARCHY, PERMISSIONS } from "@/lib/constants";
import type { UserRole } from "@prisma/client";

/**
 * List team members for the current org.
 */
export async function listTeamMembersAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const users = await db.user.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return users;
}

/**
 * Add a new team member to the current org (org owner/admin).
 */
export async function addTeamMemberAction(data: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const callerRole = (session.user as any).role as string;

  // Validate role
  const validRoles = ["ADMIN", "MANAGER", "SENDER", "VIEWER"];
  if (!validRoles.includes(data.role)) {
    throw new Error("Invalid role");
  }

  // Can't assign a role higher than your own
  const callerRoleIndex = ROLE_HIERARCHY.indexOf(callerRole as any);
  const targetRoleIndex = ROLE_HIERARCHY.indexOf(data.role as any);
  if (targetRoleIndex >= callerRoleIndex) {
    throw new Error("You cannot assign a role equal to or higher than your own");
  }

  // Check if email already exists
  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error("A user with that email already exists");
  }

  if (data.password.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await db.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      orgId,
      role: data.role as UserRole,
    },
  });

  return { success: true, userId: user.id };
}

/**
 * Update a team member's role (org owner/admin).
 */
export async function updateTeamMemberRoleAction(userId: string, newRole: string) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const callerRole = (session.user as any).role as string;
  const callerId = (session.user as any).id;

  // Can't change your own role
  if (userId === callerId) {
    throw new Error("You cannot change your own role");
  }

  const validRoles = ["ADMIN", "MANAGER", "SENDER", "VIEWER"];
  if (!validRoles.includes(newRole)) {
    throw new Error("Invalid role");
  }

  // Can't assign a role higher than your own
  const callerRoleIndex = ROLE_HIERARCHY.indexOf(callerRole as any);
  const targetRoleIndex = ROLE_HIERARCHY.indexOf(newRole as any);
  if (targetRoleIndex >= callerRoleIndex) {
    throw new Error("You cannot assign a role equal to or higher than your own");
  }

  // Verify user belongs to this org
  const user = await db.user.findFirst({ where: { id: userId, orgId } });
  if (!user) {
    throw new Error("User not found");
  }

  // Can't change the role of someone with equal or higher role
  const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role as any);
  if (userRoleIndex >= callerRoleIndex) {
    throw new Error("You cannot modify a user with equal or higher role");
  }

  await db.user.update({
    where: { id: userId },
    data: { role: newRole as UserRole },
  });

  return { success: true };
}

/**
 * Remove a team member from the org (org owner/admin).
 */
export async function removeTeamMemberAction(userId: string) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const callerId = (session.user as any).id;
  const callerRole = (session.user as any).role as string;

  if (userId === callerId) {
    throw new Error("You cannot remove yourself");
  }

  const user = await db.user.findFirst({ where: { id: userId, orgId } });
  if (!user) {
    throw new Error("User not found");
  }

  // Can't remove someone with equal or higher role
  const callerRoleIndex = ROLE_HIERARCHY.indexOf(callerRole as any);
  const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role as any);
  if (userRoleIndex >= callerRoleIndex) {
    throw new Error("You cannot remove a user with equal or higher role");
  }

  await db.user.delete({ where: { id: userId } });

  return { success: true };
}

/**
 * Admin: Add a user to any org (super admin only).
 */
export async function adminAddUserToOrgAction(data: {
  orgId: string;
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  await requireSuperAdmin();

  const validRoles = ["OWNER", "ADMIN", "MANAGER", "SENDER", "VIEWER"];
  if (!validRoles.includes(data.role)) {
    throw new Error("Invalid role");
  }

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error("A user with that email already exists");
  }

  const org = await db.organization.findUnique({ where: { id: data.orgId } });
  if (!org) {
    throw new Error("Organization not found");
  }

  if (data.password.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await db.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      orgId: data.orgId,
      role: data.role as UserRole,
    },
  });

  return { success: true, userId: user.id };
}
