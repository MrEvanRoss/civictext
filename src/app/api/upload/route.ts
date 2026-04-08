import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/3gpp"];

const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 600 * 1024; // 600KB per Twilio MMS limits

const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/3gpp": ".3gp",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALL_ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.type}. Allowed: JPG, PNG, GIF, WebP, MP4, 3GP`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    const maxLabel = isVideo ? "600KB" : "5MB";

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: `File too large. ${isVideo ? "Video" : "Image"} max size is ${maxLabel}. Your file: ${(file.size / 1024).toFixed(0)}KB`,
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = EXTENSION_MAP[file.type] || ".bin";
    const uniqueId = crypto.randomBytes(12).toString("hex");
    const filename = `${uniqueId}${ext}`;

    // On Vercel the filesystem is read-only, so write to /tmp.
    // Locally, write to public/uploads for convenience.
    const isVercel = !!process.env.VERCEL;
    const uploadsDir = isVercel
      ? path.join("/tmp", "uploads")
      : path.join(process.cwd(), "public", "uploads");

    await mkdir(uploadsDir, { recursive: true });

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    // Build public URL — on Vercel, serve via API route; locally, serve as static
    const publicUrl = isVercel
      ? `/api/uploads/${filename}`
      : `/uploads/${filename}`;

    return NextResponse.json({
      url: publicUrl,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
