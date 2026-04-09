import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const signupSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number format"),
  orgSlug: z.string().min(1, "Organization slug is required"),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 signups per IP per hour
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const { allowed } = await rateLimit(`rl:signup:${ip}`, 10, 3600);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validated = signupSchema.parse(body);

    // Normalize phone number — ensure it starts with +1 for US
    let phone = validated.phone.replace(/\D/g, "");
    if (phone.length === 10) {
      phone = `+1${phone}`;
    } else if (phone.length === 11 && phone.startsWith("1")) {
      phone = `+${phone}`;
    } else if (!validated.phone.startsWith("+")) {
      phone = `+${phone}`;
    } else {
      phone = validated.phone;
    }

    // Find org by slug
    const org = await db.organization.findUnique({
      where: { slug: validated.orgSlug },
      select: { id: true, name: true, status: true },
    });

    if (!org || org.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if contact already exists for this org+phone
    const existing = await db.contact.findFirst({
      where: {
        orgId: org.id,
        phone,
        deletedAt: null,
      },
    });

    if (existing) {
      // If they already exist and are opted in, just return success
      if (
        existing.optInStatus === "OPTED_IN" ||
        existing.optInStatus === "PENDING"
      ) {
        return NextResponse.json({ success: true, alreadyExists: true });
      }

      // If they opted out previously, re-set to pending
      await db.contact.update({
        where: { id: existing.id },
        data: {
          optInStatus: "PENDING",
          optInSource: "web_signup",
          optInTimestamp: new Date(),
          optOutTimestamp: null,
          firstName: validated.firstName || existing.firstName,
          lastName: validated.lastName || existing.lastName,
        },
      });

      return NextResponse.json({ success: true });
    }

    // M-7: Check for a soft-deleted contact with the same phone and restore it
    const softDeleted = await db.contact.findFirst({
      where: { orgId: org.id, phone, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    });

    if (softDeleted) {
      await db.contact.update({
        where: { id: softDeleted.id },
        data: {
          deletedAt: null,
          firstName: validated.firstName || softDeleted.firstName,
          lastName: validated.lastName || softDeleted.lastName,
          optInStatus: "PENDING",
          optInSource: "web_signup",
          optInTimestamp: new Date(),
          optOutTimestamp: null,
          tags: Array.from(new Set([...(softDeleted.tags || []), "web-signup"])),
        },
      });
      return NextResponse.json({ success: true });
    }

    // Create new contact with PENDING status
    await db.contact.create({
      data: {
        orgId: org.id,
        phone,
        firstName: validated.firstName || null,
        lastName: validated.lastName || null,
        optInStatus: "PENDING",
        optInSource: "web_signup",
        optInTimestamp: new Date(),
        tags: ["web-signup"],
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    console.error("Public signup error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
