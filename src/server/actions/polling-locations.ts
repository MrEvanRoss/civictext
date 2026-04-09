"use server";

import { requireOrg } from "./auth";
import { db } from "@/lib/db";
import {
  pollingLocationSchema,
  type PollingLocationInput,
} from "@/lib/validators/polling-locations";

// ============================================================
// LIST
// ============================================================

export async function listPollingLocationsAction(
  page = 1,
  pageSize = 20,
  search?: string
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { orgId };
  if (search) {
    where.OR = [
      { precinct: { contains: search, mode: "insensitive" } },
      { locationName: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
    ];
  }

  const [locations, total] = await Promise.all([
    db.pollingLocation.findMany({
      where,
      orderBy: { precinct: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.pollingLocation.count({ where }),
  ]);

  return { locations, total, page, pageSize };
}

// ============================================================
// GET
// ============================================================

export async function getPollingLocationAction(id: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const location = await db.pollingLocation.findFirst({
    where: { id, orgId },
  });
  if (!location) throw new Error("Polling location not found");
  return location;
}

// ============================================================
// CREATE
// ============================================================

export async function createPollingLocationAction(data: PollingLocationInput) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const validated = pollingLocationSchema.parse(data);

  // Check for existing precinct
  const existing = await db.pollingLocation.findUnique({
    where: { orgId_precinct: { orgId, precinct: validated.precinct } },
  });
  if (existing) {
    throw new Error(
      `A polling location for precinct "${validated.precinct}" already exists`
    );
  }

  return db.pollingLocation.create({
    data: {
      orgId,
      ...validated,
    },
  });
}

// ============================================================
// UPDATE
// ============================================================

export async function updatePollingLocationAction(
  id: string,
  data: PollingLocationInput
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const validated = pollingLocationSchema.parse(data);

  // Verify ownership
  const existing = await db.pollingLocation.findFirst({
    where: { id, orgId },
  });
  if (!existing) throw new Error("Polling location not found");

  // If precinct changed, check for conflicts
  if (validated.precinct !== existing.precinct) {
    const conflict = await db.pollingLocation.findUnique({
      where: { orgId_precinct: { orgId, precinct: validated.precinct } },
    });
    if (conflict) {
      throw new Error(
        `A polling location for precinct "${validated.precinct}" already exists`
      );
    }
  }

  return db.pollingLocation.update({
    where: { id },
    data: validated,
  });
}

// ============================================================
// DELETE
// ============================================================

export async function deletePollingLocationAction(id: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const existing = await db.pollingLocation.findFirst({
    where: { id, orgId },
  });
  if (!existing) throw new Error("Polling location not found");

  await db.pollingLocation.delete({ where: { id } });
  return { success: true };
}

// ============================================================
// BULK IMPORT (CSV rows → upsert)
// ============================================================

export async function bulkImportPollingLocationsAction(
  rows: PollingLocationInput[]
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  let created = 0;
  let updated = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = pollingLocationSchema.safeParse(row);

    if (!result.success) {
      errors.push({
        row: i + 1,
        message: result.error.issues.map((e) => e.message).join(", "),
      });
      continue;
    }

    try {
      const existing = await db.pollingLocation.findUnique({
        where: {
          orgId_precinct: { orgId, precinct: result.data.precinct },
        },
      });

      if (existing) {
        await db.pollingLocation.update({
          where: { id: existing.id },
          data: result.data,
        });
        updated++;
      } else {
        await db.pollingLocation.create({
          data: { orgId, ...result.data },
        });
        created++;
      }
    } catch (err: unknown) {
      errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { created, updated, errors };
}

// ============================================================
// EXPORT (CSV string)
// ============================================================

export async function exportPollingLocationsAction() {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const locations = await db.pollingLocation.findMany({
    where: { orgId },
    orderBy: { precinct: "asc" },
  });

  const header =
    "Precinct,Location Name,Street,City,State,ZIP,Poll Open,Poll Close,Notes";
  const rows = locations.map((loc) =>
    [
      csvEscape(loc.precinct),
      csvEscape(loc.locationName),
      csvEscape(loc.street),
      csvEscape(loc.city),
      csvEscape(loc.state),
      csvEscape(loc.zip),
      csvEscape(loc.pollOpenTime || ""),
      csvEscape(loc.pollCloseTime || ""),
      csvEscape(loc.notes || ""),
    ].join(",")
  );

  return [header, ...rows].join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================================
// LOOKUP (for merge field resolution)
// ============================================================

export async function lookupPollingLocationAction(precinct: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  return db.pollingLocation.findUnique({
    where: { orgId_precinct: { orgId, precinct } },
  });
}
