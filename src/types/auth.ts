import { UserRole } from "@prisma/client";
import { DefaultSession } from "next-auth";

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      orgId: string;
      role: UserRole;
      isSuperAdmin: boolean;
      image?: string | null;
    } & DefaultSession["user"];
  }
}
