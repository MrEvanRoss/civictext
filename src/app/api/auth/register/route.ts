import { NextResponse } from "next/server";
import { registerUser } from "@/server/actions/auth";
import { rateLimitAuth } from "@/lib/rate-limit";
import { validateApiCsrf } from "@/lib/csrf";
import { z } from "zod";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(12, "Password must be at least 12 characters"),
  name: z.string().min(1, "Name is required"),
  orgName: z.string().min(1, "Organization name is required"),
});

export async function POST(request: Request) {
  try {
    // C-4: CSRF origin validation
    const csrfError = await validateApiCsrf(request);
    if (csrfError) return csrfError;

    // Rate limit: 10 registration attempts per 15 minutes per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed, remaining } = await rateLimitAuth(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } }
      );
    }

    const body = await request.json();
    const data = registerSchema.parse(body);
    const result = await registerUser(data);

    return NextResponse.json(
      { success: true, userId: result.user.id, orgId: result.org.id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Email already registered") {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
