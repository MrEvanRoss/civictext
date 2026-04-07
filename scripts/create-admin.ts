/**
 * Create a super admin user for CivicText.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <email> <password> <name>
 *
 * Example:
 *   npx tsx scripts/create-admin.ts admin@civictext.com MySecurePass123 "Admin User"
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import bcrypt from "bcryptjs";

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || "Super Admin";

if (!email || !password) {
  console.error("Usage: npx tsx scripts/create-admin.ts <email> <password> [name]");
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

if (password.length < 12) {
  console.error("Error: Password must be at least 12 characters.");
  process.exit(1);
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter } as any);

  try {
    // Check if user exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      console.error(`Error: User with email "${email}" already exists.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create a platform org for the admin
    const org = await db.organization.create({
      data: {
        name: "CivicText Platform",
        slug: "civictext-platform",
      },
    });

    // Create messaging plan
    await db.messagingPlan.create({
      data: {
        orgId: org.id,
        tier: "ENTERPRISE",
        monthlyAllotment: 1000000,
      },
    });

    // Create super admin user
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name,
        orgId: org.id,
        role: "OWNER",
        isSuperAdmin: true,
      },
    });

    console.log("");
    console.log("Super admin created successfully!");
    console.log(`  Email: ${email}`);
    console.log(`  Name:  ${name}`);
    console.log(`  Org:   CivicText Platform (${org.id})`);
    console.log(`  User:  ${user.id}`);
    console.log("");
    console.log("You can now log in at your app URL.");
  } catch (err) {
    console.error("Failed to create admin:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main();
