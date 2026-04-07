import { z } from "zod";

export const createContactSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number format"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.string(), z.string()).default({}),
  optInStatus: z.enum(["OPTED_IN", "PENDING"]).default("PENDING"),
  optInSource: z.string().optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const contactFilterSchema = z.object({
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  optInStatus: z.enum(["OPTED_IN", "OPTED_OUT", "PENDING"]).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  sortBy: z.enum(["createdAt", "firstName", "lastName", "phone", "lastMessageAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ContactFilter = z.infer<typeof contactFilterSchema>;

export const createSegmentSchema = z.object({
  name: z.string().min(1, "Segment name is required"),
  rules: z.object({
    operator: z.enum(["AND", "OR"]),
    conditions: z.array(
      z.object({
        field: z.string(),
        operator: z.enum(["equals", "not_equals", "contains", "not_contains", "in", "not_in", "gt", "lt", "gte", "lte", "is_set", "is_not_set"]),
        value: z.union([z.string(), z.array(z.string()), z.number()]).optional(),
      })
    ),
  }),
});

export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;

export const columnMappingSchema = z.object({
  phone: z.string().min(1, "Phone column is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  tags: z.string().optional(),
});

export type ColumnMapping = z.infer<typeof columnMappingSchema>;
