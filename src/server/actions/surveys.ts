"use server";

import { db } from "@/lib/db";
import { requireOrg } from "./auth";

/**
 * List all surveys for the current org with response counts, paginated.
 */
export async function listSurveysAction(opts?: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const where: any = { orgId };
  if (opts?.status) {
    where.status = opts.status;
  }

  const [surveys, total] = await Promise.all([
    db.survey.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        _count: { select: { responses: true } },
        campaign: { select: { id: true, name: true } },
      },
    }),
    db.survey.count({ where }),
  ]);

  return { surveys, total, page, pageSize };
}

/**
 * Get a single survey with all options.
 */
export async function getSurveyAction(surveyId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const survey = await db.survey.findFirst({
    where: { id: surveyId, orgId },
    include: {
      campaign: { select: { id: true, name: true, totalRecipients: true } },
      _count: { select: { responses: true } },
    },
  });

  if (!survey) throw new Error("Survey not found");
  return survey;
}

/**
 * Create a new survey.
 */
export async function createSurveyAction(data: {
  name: string;
  question: string;
  type: string;
  options?: string[];
  allowOther?: boolean;
  campaignId?: string;
}) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  if (!data.name.trim()) throw new Error("Name is required");
  if (!data.question.trim()) throw new Error("Question is required");

  // If a campaignId is provided, verify it belongs to this org
  if (data.campaignId) {
    const campaign = await db.campaign.findFirst({
      where: { id: data.campaignId, orgId },
    });
    if (!campaign) throw new Error("Campaign not found");
  }

  return db.survey.create({
    data: {
      orgId,
      name: data.name.trim(),
      question: data.question.trim(),
      type: data.type as any,
      options: data.options || [],
      allowOther: data.allowOther ?? false,
      campaignId: data.campaignId || null,
    },
  });
}

/**
 * Update a survey.
 */
export async function updateSurveyAction(
  surveyId: string,
  data: {
    name?: string;
    question?: string;
    type?: string;
    options?: string[];
    allowOther?: boolean;
    campaignId?: string | null;
    status?: string;
  }
) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const existing = await db.survey.findFirst({
    where: { id: surveyId, orgId },
  });
  if (!existing) throw new Error("Survey not found");

  // If setting a campaignId, verify it belongs to this org
  if (data.campaignId) {
    const campaign = await db.campaign.findFirst({
      where: { id: data.campaignId, orgId },
    });
    if (!campaign) throw new Error("Campaign not found");
  }

  return db.survey.update({
    where: { id: surveyId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.question !== undefined && { question: data.question.trim() }),
      ...(data.type !== undefined && { type: data.type as any }),
      ...(data.options !== undefined && { options: data.options }),
      ...(data.allowOther !== undefined && { allowOther: data.allowOther }),
      ...(data.campaignId !== undefined && { campaignId: data.campaignId || null }),
      ...(data.status !== undefined && { status: data.status as any }),
    },
  });
}

/**
 * Delete a survey.
 */
export async function deleteSurveyAction(surveyId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const existing = await db.survey.findFirst({
    where: { id: surveyId, orgId },
  });
  if (!existing) throw new Error("Survey not found");

  await db.survey.delete({ where: { id: surveyId } });
}

/**
 * Get aggregated survey results.
 */
export async function getSurveyResultsAction(surveyId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const survey = await db.survey.findFirst({
    where: { id: surveyId, orgId },
    include: {
      campaign: { select: { totalRecipients: true } },
    },
  });
  if (!survey) throw new Error("Survey not found");

  const responses = await db.surveyResponse.findMany({
    where: { surveyId },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
    },
    orderBy: { respondedAt: "desc" },
  });

  const totalResponses = responses.length;

  // Calculate response rate if linked to a campaign
  let responseRate: number | null = null;
  if (survey.campaign && survey.campaign.totalRecipients > 0) {
    responseRate = Math.round((totalResponses / survey.campaign.totalRecipients) * 100);
  }

  // Aggregate results by answer
  const answerCounts: Record<string, number> = {};
  for (const r of responses) {
    answerCounts[r.answer] = (answerCounts[r.answer] || 0) + 1;
  }

  const aggregated = Object.entries(answerCounts)
    .map(([option, count]) => ({
      option,
      count,
      percentage: totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Recent individual responses (last 50)
  const recentResponses = responses.slice(0, 50).map((r) => ({
    contactName:
      r.contact.firstName || r.contact.lastName
        ? `${r.contact.firstName || ""} ${r.contact.lastName || ""}`.trim()
        : r.contact.phone,
    answer: r.answer,
    respondedAt: r.respondedAt,
  }));

  return {
    aggregated,
    totalResponses,
    responseRate,
    recentResponses,
  };
}

/**
 * Export survey results as CSV string.
 */
export async function exportSurveyResultsAction(surveyId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const survey = await db.survey.findFirst({
    where: { id: surveyId, orgId },
  });
  if (!survey) throw new Error("Survey not found");

  const responses = await db.surveyResponse.findMany({
    where: { surveyId },
    include: {
      contact: {
        select: { firstName: true, lastName: true, phone: true, email: true },
      },
    },
    orderBy: { respondedAt: "asc" },
  });

  // Build CSV
  const header = "First Name,Last Name,Phone,Email,Answer,Raw Message,Responded At";
  const rows = responses.map((r) => {
    const escape = (v: string | null | undefined) => {
      if (!v) return "";
      // Escape quotes and wrap in quotes if contains comma/newline/quote
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    return [
      escape(r.contact.firstName),
      escape(r.contact.lastName),
      escape(r.contact.phone),
      escape(r.contact.email),
      escape(r.answer),
      escape(r.rawMessage),
      r.respondedAt.toISOString(),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Close a survey (set status to CLOSED).
 */
export async function closeSurveyAction(surveyId: string) {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  const existing = await db.survey.findFirst({
    where: { id: surveyId, orgId },
  });
  if (!existing) throw new Error("Survey not found");

  return db.survey.update({
    where: { id: surveyId },
    data: { status: "CLOSED" },
  });
}

/**
 * List campaigns for linking to a survey (helper for the form dropdown).
 */
export async function listCampaignsForSurveyAction() {
  const { session } = await requireOrg();
  const orgId = session.user.orgId;

  return db.campaign.findMany({
    where: { orgId },
    select: { id: true, name: true, type: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
