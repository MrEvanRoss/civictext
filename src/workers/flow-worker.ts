import { Worker, Queue, type Job } from "bullmq";
import { db } from "@/lib/db";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export const flowQueue = new Queue("flows", { connection });

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

interface ExecuteStepJobData {
  executionId: string;
  stepId: string;
}

// Re-export the message queue so we can enqueue messages from the flow worker
// without a circular dependency on the full message-worker module.
const messageQueue = new Queue("messages", { connection });

// ---------------------------------------------------------------------------
// Flow Worker: Processes one step of a flow execution at a time.
// ---------------------------------------------------------------------------

export const flowWorker = new Worker<ExecuteStepJobData>(
  "flows",
  async (job: Job<ExecuteStepJobData>) => {
    const { executionId, stepId } = job.data;

    // Load execution and step
    const execution = await db.flowExecution.findUnique({
      where: { id: executionId },
      include: {
        flow: { select: { id: true, orgId: true, status: true } },
        contact: true,
      },
    });

    if (!execution) {
      await job.log(`Execution ${executionId} not found, skipping.`);
      return { status: "skipped", reason: "execution_not_found" };
    }

    // Abort if execution is no longer active
    if (execution.status !== "ACTIVE") {
      await job.log(`Execution ${executionId} is ${execution.status}, skipping.`);
      return { status: "skipped", reason: `execution_${execution.status.toLowerCase()}` };
    }

    // Abort if the flow has been paused or archived
    if (execution.flow.status !== "ACTIVE") {
      await job.log(`Flow ${execution.flow.id} is ${execution.flow.status}, pausing execution.`);
      await db.flowExecution.update({
        where: { id: executionId },
        data: { status: "PAUSED" },
      });
      return { status: "paused", reason: "flow_not_active" };
    }

    const step = await db.flowStep.findUnique({
      where: { id: stepId },
    });

    if (!step) {
      await job.log(`Step ${stepId} not found, marking execution failed.`);
      await db.flowExecution.update({
        where: { id: executionId },
        data: { status: "FAILED", completedAt: new Date() },
      });
      return { status: "failed", reason: "step_not_found" };
    }

    // Update current step on execution
    await db.flowExecution.update({
      where: { id: executionId },
      data: { currentStepId: stepId },
    });

    const orgId = execution.flow.orgId;
    const contact = execution.contact;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = step.config as Record<string, any>;

    // -----------------------------------------------------------------------
    // Step type handlers
    // -----------------------------------------------------------------------
    try {
      switch (step.type) {
        // -------------------------------------------------------------------
        // SEND_MESSAGE: Queue a message via the existing message system
        // -------------------------------------------------------------------
        case "SEND_MESSAGE": {
          const messageBody = config.messageBody || config.body || "";
          const mediaUrl = config.mediaUrl || undefined;

          if (!messageBody && !mediaUrl) {
            await job.log("SEND_MESSAGE: no body or media, skipping.");
            break;
          }

          // Create message record
          const message = await db.message.create({
            data: {
              orgId,
              contactId: contact.id,
              direction: "OUTBOUND",
              body: messageBody,
              mediaUrl: mediaUrl || null,
              status: "QUEUED",
            },
          });

          // Queue for sending
          await messageQueue.add("send", {
            orgId,
            contactId: contact.id,
            messageBody,
            mediaUrl,
            phone: contact.phone,
            firstName: contact.firstName,
            lastName: contact.lastName,
            messageId: message.id,
          }, { priority: 5 });

          await job.log(`SEND_MESSAGE: queued message ${message.id} to ${contact.phone}`);
          break;
        }

        // -------------------------------------------------------------------
        // WAIT_DELAY: Re-enqueue the next step with a delay
        // -------------------------------------------------------------------
        case "WAIT_DELAY": {
          const delayMs = resolveDelayMs(config);

          if (delayMs <= 0) {
            await job.log("WAIT_DELAY: delay <= 0, advancing immediately.");
            break;
          }

          // Find the next step and queue it with the delay
          const nextStep = await getNextStep(step.flowId, step.position);
          if (nextStep) {
            await flowQueue.add("execute-step", {
              executionId,
              stepId: nextStep.id,
            }, { delay: delayMs });
            await job.log(`WAIT_DELAY: next step ${nextStep.id} delayed by ${delayMs}ms`);
          } else {
            // No next step: mark completed
            await db.flowExecution.update({
              where: { id: executionId },
              data: { status: "COMPLETED", completedAt: new Date() },
            });
            await job.log("WAIT_DELAY: no next step, execution completed.");
          }
          // Return early — the delay step itself handles advancement
          return { status: "waiting", delayMs };
        }

        // -------------------------------------------------------------------
        // ADD_TAG: Add tags to the contact
        // -------------------------------------------------------------------
        case "ADD_TAG": {
          const tag = config.tag || config.tagName;
          if (!tag) {
            await job.log("ADD_TAG: no tag specified, skipping.");
            break;
          }

          const currentTags = contact.tags || [];
          if (!currentTags.includes(tag)) {
            await db.contact.update({
              where: { id: contact.id },
              data: { tags: [...currentTags, tag] },
            });
            await job.log(`ADD_TAG: added "${tag}" to contact ${contact.id}`);
          } else {
            await job.log(`ADD_TAG: contact already has tag "${tag}"`);
          }
          break;
        }

        // -------------------------------------------------------------------
        // REMOVE_TAG: Remove tags from the contact
        // -------------------------------------------------------------------
        case "REMOVE_TAG": {
          const tag = config.tag || config.tagName;
          if (!tag) {
            await job.log("REMOVE_TAG: no tag specified, skipping.");
            break;
          }

          const currentTags = contact.tags || [];
          if (currentTags.includes(tag)) {
            await db.contact.update({
              where: { id: contact.id },
              data: { tags: currentTags.filter((t: string) => t !== tag) },
            });
            await job.log(`REMOVE_TAG: removed "${tag}" from contact ${contact.id}`);
          } else {
            await job.log(`REMOVE_TAG: contact does not have tag "${tag}"`);
          }
          break;
        }

        // -------------------------------------------------------------------
        // ADD_TO_LIST: Add the contact to an interest list
        // -------------------------------------------------------------------
        case "ADD_TO_LIST": {
          const listId = config.listId || config.interestListId;
          if (!listId) {
            await job.log("ADD_TO_LIST: no listId specified, skipping.");
            break;
          }

          // Upsert membership (idempotent)
          const existing = await db.interestListMember.findUnique({
            where: {
              interestListId_contactId: { interestListId: listId, contactId: contact.id },
            },
          });

          if (!existing) {
            await db.interestListMember.create({
              data: {
                interestListId: listId,
                contactId: contact.id,
                source: "flow",
              },
            });
            // Increment member count
            await db.interestList.update({
              where: { id: listId },
              data: { memberCount: { increment: 1 } },
            });
            await job.log(`ADD_TO_LIST: added contact to list ${listId}`);
          } else {
            await job.log(`ADD_TO_LIST: contact already on list ${listId}`);
          }
          break;
        }

        // -------------------------------------------------------------------
        // REMOVE_FROM_LIST: Remove the contact from an interest list
        // -------------------------------------------------------------------
        case "REMOVE_FROM_LIST": {
          const listId = config.listId || config.interestListId;
          if (!listId) {
            await job.log("REMOVE_FROM_LIST: no listId specified, skipping.");
            break;
          }

          const membership = await db.interestListMember.findUnique({
            where: {
              interestListId_contactId: { interestListId: listId, contactId: contact.id },
            },
          });

          if (membership) {
            await db.interestListMember.delete({
              where: { id: membership.id },
            });
            // Decrement member count
            await db.interestList.update({
              where: { id: listId },
              data: { memberCount: { decrement: 1 } },
            });
            await job.log(`REMOVE_FROM_LIST: removed contact from list ${listId}`);
          } else {
            await job.log(`REMOVE_FROM_LIST: contact not on list ${listId}`);
          }
          break;
        }

        // -------------------------------------------------------------------
        // BRANCH_CONDITION: Evaluate a condition and advance to yes/no child step
        // -------------------------------------------------------------------
        case "BRANCH_CONDITION": {
          const branchResult = evaluateBranchCondition(config, contact);
          await job.log(`BRANCH_CONDITION: evaluated to ${branchResult}`);

          const targetStepId = branchResult ? step.yesStepId : step.noStepId;

          if (targetStepId) {
            await flowQueue.add("execute-step", {
              executionId,
              stepId: targetStepId,
            });
            await job.log(`BRANCH_CONDITION: advancing to ${branchResult ? "yes" : "no"} step ${targetStepId}`);
          } else {
            // No branch target: mark execution completed
            await db.flowExecution.update({
              where: { id: executionId },
              data: { status: "COMPLETED", completedAt: new Date() },
            });
            await job.log(`BRANCH_CONDITION: no ${branchResult ? "yes" : "no"} step, execution completed.`);
          }
          // Branch handles its own advancement
          return { status: "branched", result: branchResult };
        }

        // -------------------------------------------------------------------
        // UPDATE_CONTACT: Update contact fields
        // -------------------------------------------------------------------
        case "UPDATE_CONTACT": {
          const fields = config.fields || {};
          const allowedFields = [
            "firstName", "lastName", "prefix", "suffix",
            "email", "street", "city", "state", "zip", "precinct",
          ];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updateData: Record<string, any> = {};
          for (const [key, value] of Object.entries(fields)) {
            if (allowedFields.includes(key)) {
              updateData[key] = value;
            }
          }

          if (Object.keys(updateData).length > 0) {
            await db.contact.update({
              where: { id: contact.id },
              data: updateData,
            });
            await job.log(`UPDATE_CONTACT: updated fields ${Object.keys(updateData).join(", ")}`);
          } else {
            await job.log("UPDATE_CONTACT: no valid fields to update.");
          }
          break;
        }

        // -------------------------------------------------------------------
        // WAIT_FOR_REPLY: Pause execution until contact replies
        // -------------------------------------------------------------------
        case "WAIT_FOR_REPLY": {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const executionData = (execution.data as Record<string, any>) || {};
          await db.flowExecution.update({
            where: { id: executionId },
            data: {
              data: { ...executionData, waitingForReply: true, waitStepId: stepId },
            },
          });
          await job.log("WAIT_FOR_REPLY: waiting for contact reply. Webhook will resume.");
          // Do NOT advance — the inbound message webhook will resume the flow
          return { status: "waiting_for_reply" };
        }

        default:
          await job.log(`Unknown step type: ${step.type}`);
          break;
      }
    } catch (err: unknown) {
      await job.log(`Step execution error: ${err instanceof Error ? err.message : String(err)}`);
      throw err; // Let BullMQ handle retries
    }

    // -----------------------------------------------------------------------
    // After step completion: find and queue the next step
    // -----------------------------------------------------------------------
    const nextStep = await getNextStep(step.flowId, step.position);

    if (nextStep) {
      await flowQueue.add("execute-step", {
        executionId,
        stepId: nextStep.id,
      });
      await job.log(`Advancing to next step: ${nextStep.id} (position ${nextStep.position})`);
      return { status: "advanced", nextStepId: nextStep.id };
    } else {
      // No more steps — execution complete
      await db.flowExecution.update({
        where: { id: executionId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await job.log("No more steps, execution completed.");
      return { status: "completed" };
    }
  },
  {
    connection,
    concurrency: 10,
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        // Exponential backoff: 5s, 10s, 20s
        return Math.min(5000 * Math.pow(2, attemptsMade - 1), 60000);
      },
    },
  }
);

// ---------------------------------------------------------------------------
// Helper: Get the next sequential step in the flow
// ---------------------------------------------------------------------------

async function getNextStep(flowId: string, currentPosition: number) {
  return db.flowStep.findFirst({
    where: {
      flowId,
      position: { gt: currentPosition },
    },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
}

// ---------------------------------------------------------------------------
// Helper: Resolve delay in milliseconds from step config
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDelayMs(config: Record<string, any>): number {
  if (config.delayMs) return Number(config.delayMs);
  if (config.delayMinutes) return Number(config.delayMinutes) * 60 * 1000;
  if (config.delayHours) return Number(config.delayHours) * 60 * 60 * 1000;
  if (config.delayDays) return Number(config.delayDays) * 24 * 60 * 60 * 1000;
  return 0;
}

// ---------------------------------------------------------------------------
// Helper: Evaluate a branch condition against a contact
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function evaluateBranchCondition(config: Record<string, any>, contact: Record<string, any>): boolean {
  const { field, operator, value } = config;

  if (!field || !operator) return false;

  // Special handling for tags (array field)
  if (field === "tags") {
    const tags: string[] = contact.tags || [];
    switch (operator) {
      case "contains":
        return tags.includes(value);
      case "not_contains":
        return !tags.includes(value);
      case "is_empty":
        return tags.length === 0;
      case "is_not_empty":
        return tags.length > 0;
      default:
        return false;
    }
  }

  const contactValue = contact[field];

  switch (operator) {
    case "equals":
      return String(contactValue) === String(value);
    case "not_equals":
      return String(contactValue) !== String(value);
    case "contains":
      return String(contactValue || "").toLowerCase().includes(String(value).toLowerCase());
    case "not_contains":
      return !String(contactValue || "").toLowerCase().includes(String(value).toLowerCase());
    case "is_empty":
      return !contactValue || contactValue === "";
    case "is_not_empty":
      return !!contactValue && contactValue !== "";
    case "starts_with":
      return String(contactValue || "").toLowerCase().startsWith(String(value).toLowerCase());
    case "ends_with":
      return String(contactValue || "").toLowerCase().endsWith(String(value).toLowerCase());
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

flowWorker.on("failed", (job, err) => {
  if (job && job.attemptsMade >= 3) {
    // Mark execution as FAILED after exhausting retries
    const { executionId } = job.data;
    db.flowExecution
      .update({
        where: { id: executionId },
        data: { status: "FAILED", completedAt: new Date() },
      })
      .catch((e) => {
        console.error(`Failed to mark execution ${executionId} as FAILED:`, e instanceof Error ? e.message : e);
      });
    console.error(`Flow job ${job.id} permanently failed after ${job.attemptsMade} attempts:`, err instanceof Error ? err.message : err);
  } else {
    console.error(`Flow job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err instanceof Error ? err.message : err);
  }
});

flowWorker.on("completed", (_job) => {
  // Logged via job.log
});

console.info("Flow worker started");
