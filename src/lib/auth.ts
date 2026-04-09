import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { authConfig } from "./auth.config";
import { verifyTOTPCode, verifyBackupCode } from "./two-factor";
import type { UserRole } from "@prisma/client";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db) as any,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const totpCode = (credentials.totpCode as string) || "";

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Two-Factor Authentication check
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!totpCode) {
            // No TOTP code provided — login page should have prompted for it
            return null;
          }

          // Try TOTP code first
          const totpValid = verifyTOTPCode(user.twoFactorSecret, totpCode);
          if (!totpValid) {
            // Try backup code
            const backupIndex = await verifyBackupCode(
              totpCode,
              user.twoFactorBackupCodes
            );
            if (backupIndex === -1) {
              return null; // Neither TOTP nor backup code matched
            }

            // Remove used backup code
            const updatedCodes = [...user.twoFactorBackupCodes];
            updatedCodes.splice(backupIndex, 1);
            await db.user.update({
              where: { id: user.id },
              data: { twoFactorBackupCodes: updatedCodes },
            });
          }
        }

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: user.orgId,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
          passwordChangedAt: user.passwordChangedAt?.toISOString() || null,
        };
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.orgId = user.orgId;
        token.role = user.role;
        token.isSuperAdmin = user.isSuperAdmin;
        token.passwordChangedAt = user.passwordChangedAt
          ? new Date(user.passwordChangedAt).getTime()
          : null;
      }

      // C-7: On every request, periodically verify the password hasn't been
      // changed since the JWT was issued (check every 5 minutes to avoid
      // excessive DB queries)
      if (trigger !== "signIn" && token.id) {
        const lastChecked = (token._pwCheckedAt as number) || 0;
        const now = Date.now();
        if (now - lastChecked > 5 * 60 * 1000) {
          try {
            const freshUser = await db.user.findUnique({
              where: { id: token.id as string },
              select: { passwordChangedAt: true },
            });
            if (freshUser?.passwordChangedAt) {
              const changedAt = new Date(freshUser.passwordChangedAt).getTime();
              const tokenPwTime = (token.passwordChangedAt as number) || 0;
              if (changedAt > tokenPwTime) {
                // Password was changed after this JWT was issued — force re-auth
                return { ...token, invalidated: true };
              }
            }
            token._pwCheckedAt = now;
          } catch {
            // DB unavailable — allow through (fail open for availability)
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      // C-7: If the token was invalidated, return empty session
      if (token.invalidated) {
        return { ...session, user: undefined as any };
      }

      if (session.user) {
        session.user.id = token.id;
        session.user.orgId = token.orgId;
        session.user.role = token.role as UserRole;
        session.user.isSuperAdmin = token.isSuperAdmin;
      }
      return session;
    },
  },
});
