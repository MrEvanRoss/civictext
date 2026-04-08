import { db } from "./db";

// Models that are scoped to an organization
const TENANT_SCOPED_MODELS = [
  "Contact",
  "Campaign",
  "Message",
  "Segment",
  "ConsentAuditLog",
  "PhoneNumber",
  "BrandRegistration",
  "CampaignRegistration",
  "AutoReplyRule",
  "Conversation",
  "ConversationNote",
  "QuickReplyTemplate",
  "DripStep",
  "UsageLedger",
  "ImportJob",
  "AddOnPurchase",
  "BillingAlert",
] as const;

type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

function isTenantScoped(model: string): model is TenantScopedModel {
  return TENANT_SCOPED_MODELS.includes(model as TenantScopedModel);
}

/**
 * Returns a Prisma client extended with automatic org scoping.
 * All reads filter by orgId, all creates inject orgId.
 * This is the PRIMARY way to access tenant data — never use raw `db` for tenant queries.
 */
export function getTenantDb(orgId: string) {
  return db.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = { ...args.where, orgId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = { ...args.where, orgId };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          // findUnique can't add arbitrary where clauses,
          // so we validate after fetch
          const result = await query(args);
          if (result && isTenantScoped(model) && (result as any).orgId !== orgId) {
            return null; // Prevent cross-tenant access
          }
          return result;
        },
        async create({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.data = { ...args.data, orgId } as any;
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (isTenantScoped(model) && Array.isArray(args.data)) {
            args.data = (args.data as any[]).map((item) => ({
              ...item,
              orgId,
            }));
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = { ...args.where, orgId } as any;
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = { ...args.where, orgId };
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = { ...args.where, orgId } as any;
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = { ...args.where, orgId };
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = { ...args.where, orgId };
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = { ...args.where, orgId };
          }
          return query(args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof getTenantDb>;
