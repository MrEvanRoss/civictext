/**
 * Create a superadmin account.
 * Usage: npx tsx scripts/create-superadmin.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL || "postgresql://civictext:civictext_dev@localhost:5432/civictext?schema=public";
const adapter = new PrismaPg(connectionString);
const db = new PrismaClient({ adapter });

async function main() {
  const email = "CivicTextAdmin@EvanRoss.com";
  const password = "CivicTextAdmin2026!";
  const name = "CivicText Admin";

  // Check if user already exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists. Updating to superadmin...`);
    await db.user.update({
      where: { email },
      data: { isSuperAdmin: true, role: "OWNER" },
    });
    console.log("Done. User is now a superadmin.");
    return;
  }

  // Need an org for the user — create a platform admin org
  let adminOrg = await db.organization.findFirst({
    where: { slug: "civictext-admin" },
  });

  if (!adminOrg) {
    adminOrg = await db.organization.create({
      data: {
        name: "CivicText Platform",
        slug: "civictext-admin",
        orgType: "platform",
        status: "ACTIVE",
      },
    });
    console.log("Created platform admin org.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      email,
      passwordHash,
      name,
      orgId: adminOrg.id,
      role: "OWNER",
      isSuperAdmin: true,
    },
  });

  console.log(`Superadmin created: ${email}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
