"use server";

import { requireOrg, requirePermission } from "./auth";
import { PERMISSIONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { z } from "zod";
import type { FlowStatus, FlowTrigger, FlowStepType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createFlowSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  trigger: z.enum(["KEYWORD", "TAG_ADDED", "LIST_JOINED", "CONTACT_CREATED", "MANUAL"]),
  triggerConfig: z.record(z.string(), z.unknown()).optional().default({}),
  description: z.string().max(1000).optional(),
});

const updateFlowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  trigger: z.enum(["KEYWORD", "TAG_ADDED", "LIST_JOINED", "CONTACT_CREATED", "MANUAL"]).optional(),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
});

const createStepSchema = z.object({
  type: z.enum([
    "SEND_MESSAGE",
    "WAIT_DELAY",
    "ADD_TAG",
    "REMOVE_TAG",
    "ADD_TO_LIST",
    "REMOVE_FROM_LIST",
    "BRANCH_CONDITION",
    "UPDATE_CONTACT",
    "WAIT_FOR_REPLY",
  ]),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  position: z.number().int().min(0).optional(),
  parentStepId: z.string().uuid().optional().nullable(),
  yesStepId: z.string().uuid().optional().nullable(),
  noStepId: z.string().uuid().optional().nullable(),
});

const updateStepSchema = z.object({
  type: z.enum([
    "SEND_MESSAGE",
    "WAIT_DELAY",
    "ADD_TAG",
    "REMOVE_TAG",
    "ADD_TO_LIST",
    "REMOVE_FROM_LIST",
    "BRANCH_CONDITION",
    "UPDATE_CONTACT",
    "WAIT_FOR_REPLY",
  ]).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
  parentStepId: z.string().uuid().optional().nullable(),
  yesStepId: z.string().uuid().optional().nullable(),
  noStepId: z.string().uuid().optional().nullable(),
});

const reorderStepSchema = z.array(
  z.object({
    id: z.string().uuid(),
    position: z.number().int().min(0),
  })
);

// ---------------------------------------------------------------------------
// Flow CRUD actions
// ---------------------------------------------------------------------------

/**
 * List flows for the current org, with step count and execution count.
 */
export async function listFlowsAction() {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  const flows = await db.flow.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          steps: true,
          executions: true,
        },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  return flows;
}

/**
 * Get a single flow with all steps (ordered by position) and execution stats.
 */
export async function getFlowAction(flowId: string) {
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(flowId);

  const flow = await db.flow.findFirst({
    where: { id: flowId, orgId },
    include: {
      steps: {
        orderBy: { position: "asc" },
      },
      createdBy: {
        select: { id: true, name: true },
      },
      _count: {
        select: { executions: true },
      },
    },
  });

  if (!flow) throw new Error("Journey not found");

  // Get execution stats
  const [total, active, completed, failed] = await Promise.all([
    db.flowExecution.count({ where: { flowId } }),
    db.flowExecution.count({ where: { flowId, status: "ACTIVE" } }),
    db.flowExecution.count({ where: { flowId, status: "COMPLETED" } }),
    db.flowExecution.count({ where: { flowId, status: "FAILED" } }),
  ]);

  return {
    ...flow,
    stats: { total, active, completed, failed },
  };
}

/**
 * Create a new flow.
 */
export async function createFlowAction(data: {
  name: string;
  trigger: FlowTrigger;
  triggerConfig?: Record<string, unknown>;
  description?: string;
}) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const userId = (session.user as any).id;

  const validated = createFlowSchema.parse(data);

  const flow = await db.flow.create({
    data: {
      orgId,
      name: validated.name,
      description: validated.description,
      trigger: validated.trigger,
      triggerConfig: validated.triggerConfig as any,
      createdById: userId,
    },
  });

  return flow;
}

/**
 * Update flow metadata (name, description, trigger, triggerConfig).
 */
export async function updateFlowAction(
  flowId: string,
  data: {
    name?: string;
    description?: string | null;
    trigger?: FlowTrigger;
    triggerConfig?: Record<string, unknown>;
  }
) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(flowId);
  const validated = updateFlowSchema.parse(data);

  const flow = await db.flow.findFirst({
    where: { id: flowId, orgId },
  });
  if (!flow) throw new Error("Journey not found");

  const updateData: any = { ...validated };
  return db.flow.update({
    where: { id: flowId },
    data: updateData,
  });
}

/**
 * Change flow status with validation.
 * Cannot activate a flow with 0 steps.
 */
export async function updateFlowStatusAction(
  flowId: string,
  status: FlowStatus
) {
  await requirePermission(PERMISSIONS.CAMPAIGN_SEND);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(flowId);
  z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).parse(status);

  const flow = await db.flow.findFirst({
    where: { id: flowId, orgId },
    include: { _count: { select: { steps: true } } },
  });

  if (!flow) throw new Error("Journey not found");

  // Cannot activate a flow with no steps
  if (status === "ACTIVE" && flow._count.steps === 0) {
    throw new Error("Cannot activate a flow with no steps. Add at least one step first.");
  }

  // Cannot activate an archived flow directly — must un-archive to DRAFT first
  if (status === "ACTIVE" && flow.status === "ARCHIVED") {
    throw new Error("Cannot activate an archived flow. Change status to DRAFT first.");
  }

  return db.flow.update({
    where: { id: flowId },
    data: { status },
  });
}

/**
 * Duplicate a flow and all its steps.
 */
export async function duplicateFlowAction(flowId: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;
  const userId = (session.user as any).id;

  z.string().uuid().parse(flowId);

  const original = await db.flow.findFirst({
    where: { id: flowId, orgId },
    include: { steps: { orderBy: { position: "asc" } } },
  });

  if (!original) throw new Error("Journey not found");

  // Create duplicated flow in a transaction
  const duplicated = await db.$transaction(async (tx) => {
    const newFlow = await tx.flow.create({
      data: {
        orgId,
        name: `${original.name} (Copy)`,
        description: original.description,
        trigger: original.trigger,
        triggerConfig: original.triggerConfig as any,
        createdById: userId,
        status: "DRAFT",
      },
    });

    // Build a mapping from old step IDs to new step IDs
    const stepIdMap = new Map<string, string>();

    // First pass: create all steps without parent/branch references
    for (const step of original.steps) {
      const newStep = await tx.flowStep.create({
        data: {
          flowId: newFlow.id,
          type: step.type,
          config: step.config as any,
          position: step.position,
        },
      });
      stepIdMap.set(step.id, newStep.id);
    }

    // Second pass: update parent/branch references
    for (const step of original.steps) {
      const newStepId = stepIdMap.get(step.id)!;
      const updates: any = {};

      if (step.parentStepId && stepIdMap.has(step.parentStepId)) {
        updates.parentStepId = stepIdMap.get(step.parentStepId);
      }
      if (step.yesStepId && stepIdMap.has(step.yesStepId)) {
        updates.yesStepId = stepIdMap.get(step.yesStepId);
      }
      if (step.noStepId && stepIdMap.has(step.noStepId)) {
        updates.noStepId = stepIdMap.get(step.noStepId);
      }

      if (Object.keys(updates).length > 0) {
        await tx.flowStep.update({
          where: { id: newStepId },
          data: updates,
        });
      }
    }

    return newFlow;
  });

  return duplicated;
}

/**
 * Delete a flow (only DRAFT or PAUSED).
 */
export async function deleteFlowAction(flowId: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(flowId);

  const flow = await db.flow.findFirst({
    where: { id: flowId, orgId },
  });

  if (!flow) throw new Error("Journey not found");

  if (flow.status !== "DRAFT" && flow.status !== "PAUSED") {
    throw new Error(
      "Can only delete flows in DRAFT or PAUSED status. Pause or archive it first."
    );
  }

  // Steps are cascade-deleted via the schema relation
  await db.flow.delete({ where: { id: flowId } });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Flow Step actions
// ---------------------------------------------------------------------------

/**
 * Add a step to a flow at a given position.
 * Steps at and after the position are shifted down.
 */
export async function createFlowStepAction(
  flowId: string,
  stepData: {
    type: FlowStepType;
    config?: Record<string, unknown>;
    position?: number;
    parentStepId?: string | null;
    yesStepId?: string | null;
    noStepId?: string | null;
  }
) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(flowId);
  const validated = createStepSchema.parse(stepData);

  // Verify the flow belongs to this org
  const flow = await db.flow.findFirst({
    where: { id: flowId, orgId },
  });
  if (!flow) throw new Error("Journey not found");

  // Determine position: use provided or append at end
  let position = validated.position;
  if (position === undefined) {
    const maxStep = await db.flowStep.findFirst({
      where: { flowId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = (maxStep?.position ?? -1) + 1;
  } else {
    // Shift existing steps at and after this position
    await db.flowStep.updateMany({
      where: { flowId, position: { gte: position } },
      data: { position: { increment: 1 } },
    });
  }

  const step = await db.flowStep.create({
    data: {
      flowId,
      type: validated.type,
      config: validated.config as any,
      position,
      parentStepId: validated.parentStepId ?? undefined,
      yesStepId: validated.yesStepId ?? undefined,
      noStepId: validated.noStepId ?? undefined,
    },
  });

  return step;
}

/**
 * Update a step's config/type.
 */
export async function updateFlowStepAction(
  stepId: string,
  stepData: {
    type?: FlowStepType;
    config?: Record<string, unknown>;
    position?: number;
    parentStepId?: string | null;
    yesStepId?: string | null;
    noStepId?: string | null;
  }
) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(stepId);
  const validated = updateStepSchema.parse(stepData);

  // Verify step belongs to a flow in this org
  const step = await db.flowStep.findFirst({
    where: { id: stepId, flow: { orgId } },
  });
  if (!step) throw new Error("Step not found");

  const updateData: any = { ...validated };
  return db.flowStep.update({
    where: { id: stepId },
    data: updateData,
  });
}

/**
 * Delete a step and reorder remaining steps to close the gap.
 */
export async function deleteFlowStepAction(stepId: string) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(stepId);

  const step = await db.flowStep.findFirst({
    where: { id: stepId, flow: { orgId } },
    select: { id: true, flowId: true, position: true },
  });
  if (!step) throw new Error("Step not found");

  await db.$transaction([
    // Delete the step
    db.flowStep.delete({ where: { id: stepId } }),
    // Shift remaining steps to close the gap
    db.flowStep.updateMany({
      where: { flowId: step.flowId, position: { gt: step.position } },
      data: { position: { decrement: 1 } },
    }),
  ]);

  return { success: true };
}

/**
 * Reorder steps in a flow by providing an array of { id, position } pairs.
 */
export async function reorderFlowStepsAction(
  flowId: string,
  stepOrder: Array<{ id: string; position: number }>
) {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(flowId);
  const validated = reorderStepSchema.parse(stepOrder);

  // Verify flow belongs to this org
  const flow = await db.flow.findFirst({
    where: { id: flowId, orgId },
  });
  if (!flow) throw new Error("Journey not found");

  // Update all positions in a transaction
  await db.$transaction(
    validated.map((item) =>
      db.flowStep.update({
        where: { id: item.id },
        data: { position: item.position },
      })
    )
  );

  return { success: true };
}

// ---------------------------------------------------------------------------
// Flow Analytics
// ---------------------------------------------------------------------------

/**
 * Get execution analytics for a flow.
 */
export async function getFlowAnalyticsAction(flowId: string) {
  await requirePermission(PERMISSIONS.ANALYTICS_VIEW);
  const { session } = await requireOrg();
  const orgId = (session.user as any).orgId;

  z.string().uuid().parse(flowId);

  // Verify flow belongs to this org
  const flow = await db.flow.findFirst({
    where: { id: flowId, orgId },
    select: { id: true },
  });
  if (!flow) throw new Error("Journey not found");

  const [total, active, completed, failed, paused] = await Promise.all([
    db.flowExecution.count({ where: { flowId } }),
    db.flowExecution.count({ where: { flowId, status: "ACTIVE" } }),
    db.flowExecution.count({ where: { flowId, status: "COMPLETED" } }),
    db.flowExecution.count({ where: { flowId, status: "FAILED" } }),
    db.flowExecution.count({ where: { flowId, status: "PAUSED" } }),
  ]);

  // Calculate average completion time for completed executions
  const completedExecutions = await db.flowExecution.findMany({
    where: { flowId, status: "COMPLETED", completedAt: { not: null } },
    select: { startedAt: true, completedAt: true },
  });

  let avgCompletionTimeMs: number | null = null;
  if (completedExecutions.length > 0) {
    const totalMs = completedExecutions.reduce((sum, exec) => {
      return sum + (exec.completedAt!.getTime() - exec.startedAt.getTime());
    }, 0);
    avgCompletionTimeMs = Math.round(totalMs / completedExecutions.length);
  }

  return {
    total,
    active,
    completed,
    failed,
    paused,
    avgCompletionTimeMs,
  };
}
