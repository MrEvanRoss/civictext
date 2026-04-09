-- M-7: Contact Soft-Delete Unique Constraint
--
-- Problem: The original @@unique([orgId, phone]) constraint prevents
-- re-importing a contact after soft-delete because the deleted row
-- still occupies the unique slot.
--
-- Fix: Replace the full unique constraint with a partial unique index
-- that only enforces uniqueness on non-deleted contacts.

-- Drop the existing unique constraint (Prisma names it "Contact_orgId_phone_key")
DROP INDEX IF EXISTS "Contact_orgId_phone_key";

-- Create a partial unique index that only covers active (non-deleted) contacts
CREATE UNIQUE INDEX "Contact_orgId_phone_active_key"
  ON "Contact" ("orgId", "phone")
  WHERE "deletedAt" IS NULL;
