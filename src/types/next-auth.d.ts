import type { UserRole } from "@prisma/client";
import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
    orgId: string;
    role: UserRole;
    isSuperAdmin: boolean;
    passwordChangedAt?: string | null;
  }

  interface Session {
    user: {
      id: string;
      orgId: string;
      role: UserRole;
      isSuperAdmin: boolean;
      _impersonating?: boolean;
      _adminId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    orgId: string;
    role: UserRole;
    isSuperAdmin: boolean;
    passwordChangedAt?: number | null;
    _pwCheckedAt?: number;
    invalidated?: boolean;
  }
}
