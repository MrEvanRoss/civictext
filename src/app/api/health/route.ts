import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

/**
 * Health check endpoint for monitoring and load balancers.
 * Returns 200 if the app, database, and Redis are all reachable.
 * Returns 503 with details if any dependency is degraded.
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};
  let healthy = true;

  // Database check
  const dbStart = Date.now();
  try {
    await db.$queryRawUnsafe("SELECT 1");
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch {
    healthy = false;
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
    };
  }

  // Redis check
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
  } catch {
    healthy = false;
    checks.redis = {
      status: "error",
      latencyMs: Date.now() - redisStart,
    };
  }

  const body = {
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
