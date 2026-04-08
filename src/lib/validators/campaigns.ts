import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  type: z.enum(["BROADCAST", "P2P", "GOTV", "DRIP", "AUTO_REPLY"]),
  segmentId: z.string().uuid().optional(),
  messageBody: z.string().min(1, "Message body is required"),
  mediaUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
  politicalDisclaimer: z.string().optional(),
  // Drip-specific
  dripSteps: z
    .array(
      z.object({
        stepOrder: z.number().int().min(0),
        messageBody: z.string().min(1),
        mediaUrl: z.string().url().optional(),
        delayMinutes: z.number().int().min(0),
        triggerKeyword: z.string().optional(),
      })
    )
    .optional(),
  // Auto-reply specific
  autoReplyRules: z
    .array(
      z.object({
        keywords: z.array(z.string().min(1)),
        replyBody: z.string().min(1),
        priority: z.number().int().default(0),
      })
    )
    .optional(),
  // P2P-specific
  p2pScript: z.string().optional(),
  p2pReplyScript: z.string().optional(),
  p2pContactsPerAgent: z.number().int().min(1).optional(),
  // GOTV-specific settings (stored in Campaign.settings JSON)
  gotvSettings: z
    .object({
      electionDate: z.string().optional(),
      pollHours: z.string().optional(),
      defaultPollingLocation: z.string().optional(),
    })
    .optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  id: z.string().uuid(),
  status: z.enum(["DRAFT", "SCHEDULED", "SENDING", "PAUSED", "COMPLETED", "CANCELLED"]).optional(),
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const campaignFilterSchema = z.object({
  status: z.enum(["DRAFT", "SCHEDULED", "SENDING", "PAUSED", "COMPLETED", "CANCELLED"]).optional(),
  type: z.enum(["BROADCAST", "P2P", "GOTV", "DRIP", "AUTO_REPLY"]).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export type CampaignFilter = z.infer<typeof campaignFilterSchema>;
