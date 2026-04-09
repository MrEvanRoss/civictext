import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { columnMappingSchema } from "@/lib/validators/contacts";

/**
 * CSV Import API
 * Parses CSV in streaming batches, validates phone numbers, deduplicates,
 * and bulk inserts contacts.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.orgId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const mappingStr = formData.get("mapping") as string;

  if (!file || !mappingStr) {
    return NextResponse.json({ error: "Missing file or mapping" }, { status: 400 });
  }

  // M-10: Reject files over 25 MB to prevent memory exhaustion
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.` },
      { status: 400 }
    );
  }

  let mapping;
  try {
    mapping = columnMappingSchema.parse(JSON.parse(mappingStr));
  } catch {
    return NextResponse.json(
      { error: "Invalid column mapping. A valid phone column is required." },
      { status: 400 }
    );
  }

  const text = await file.text();
  const lines = text.split("\n").filter((l) => l.trim());

  if (lines.length < 2) {
    return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400 });
  }

  const headers = parseCSVLine(lines[0]);
  const phoneIdx = headers.indexOf(mapping.phone);
  const firstNameIdx = mapping.firstName ? headers.indexOf(mapping.firstName) : -1;
  const lastNameIdx = mapping.lastName ? headers.indexOf(mapping.lastName) : -1;
  const emailIdx = mapping.email ? headers.indexOf(mapping.email) : -1;
  const tagsIdx = mapping.tags ? headers.indexOf(mapping.tags) : -1;

  if (phoneIdx === -1) {
    return NextResponse.json({ error: "Phone column not found" }, { status: 400 });
  }

  let success = 0;
  let duplicates = 0;
  let errors = 0;
  const total = lines.length - 1;
  const BATCH_SIZE = 1000;

  // Process in batches
  for (let i = 1; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE);
    const contactsToCreate: any[] = [];

    for (const line of batch) {
      const row = parseCSVLine(line);
      const rawPhone = row[phoneIdx]?.trim();
      if (!rawPhone) {
        errors++;
        continue;
      }

      const phone = normalizePhone(rawPhone);
      if (!phone) {
        errors++;
        continue;
      }

      contactsToCreate.push({
        orgId,
        phone,
        firstName: firstNameIdx >= 0 ? row[firstNameIdx]?.trim() || null : null,
        lastName: lastNameIdx >= 0 ? row[lastNameIdx]?.trim() || null : null,
        email: emailIdx >= 0 ? row[emailIdx]?.trim() || null : null,
        tags: tagsIdx >= 0 ? (row[tagsIdx]?.trim() || "").split(";").map((t: string) => t.trim()).filter(Boolean) : [],
        optInStatus: "OPTED_IN",
        optInSource: "csv_import",
        optInTimestamp: new Date(),
        customFields: {},
      });
    }

    if (contactsToCreate.length > 0) {
      try {
        // M-7: Restore soft-deleted contacts instead of skipping them.
        // Collect phones for this batch and check for soft-deleted rows.
        const batchPhones = contactsToCreate.map((c: any) => c.phone as string);
        const softDeletedContacts = await db.contact.findMany({
          where: { orgId, phone: { in: batchPhones }, deletedAt: { not: null } },
          select: { id: true, phone: true },
        });
        const softDeletedByPhone = new Map(
          softDeletedContacts.map((c) => [c.phone, c.id])
        );

        // Separate into restores vs new creates
        const toRestore: any[] = [];
        const toCreate: any[] = [];
        for (const contact of contactsToCreate) {
          const deletedId = softDeletedByPhone.get(contact.phone);
          if (deletedId) {
            toRestore.push({ id: deletedId, data: contact });
            softDeletedByPhone.delete(contact.phone); // only restore once per phone
          } else {
            toCreate.push(contact);
          }
        }

        // Restore soft-deleted contacts
        for (const { id, data } of toRestore) {
          try {
            await db.contact.update({
              where: { id },
              data: {
                deletedAt: null,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                tags: data.tags,
                optInStatus: data.optInStatus,
                optInSource: data.optInSource,
                optInTimestamp: data.optInTimestamp,
                optOutTimestamp: null,
                customFields: data.customFields,
              },
            });
            success++;
          } catch (restoreErr) {
            errors++;
            console.error("Restore soft-deleted contact error:", restoreErr);
          }
        }

        // Create genuinely new contacts
        if (toCreate.length > 0) {
          const result = await db.contact.createMany({
            data: toCreate,
            skipDuplicates: true,
          });
          success += result.count;
          duplicates += toCreate.length - result.count;
        }
      } catch (err) {
        errors += contactsToCreate.length;
        console.error("Batch import error:", err);
      }
    }
  }

  return NextResponse.json({ total, success, duplicates, errors });
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) {
    return phone.startsWith("+") ? phone : `+${digits}`;
  }
  return null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
