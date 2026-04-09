import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // C-2: Configure connection pooling with explicit pool settings
  const pool = new Pool({
    connectionString,
    max: parseInt(process.env.DB_POOL_SIZE || "10", 10), // Max connections per instance
    idleTimeoutMillis: 30_000, // Close idle connections after 30s
    connectionTimeoutMillis: 5_000, // Fail fast if pool is exhausted
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
