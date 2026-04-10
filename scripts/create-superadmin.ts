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
  const rawEmail = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME || "CivicText Admin";

  if (!rawEmail || !password) {
    console.error("ERROR: Required environment variables are not set.");
    console.error("  SUPERADMIN_EMAIL    - email address for the superadmin account");
    console.error("  SUPERADMIN_PASSWORD - password for the superadmin account");
    console.error("");
    console.error("Usage:");
    console.error("  SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD=securepass npx tsx scripts/create-superadmin.ts");
    process.exit(1);
  }

  const email = rawEmail.toLowerCase().trim();

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
        orgType: "political", // admin org uses a valid orgType
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
