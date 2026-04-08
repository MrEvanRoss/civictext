"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  Tag,
  X,
  ListPlus,
  GitBranch,
  MessageCircle,
  UserCog,
  Plus,
  Trash2,
  Check,
  Pencil,
  Play,
  Pause,
  Zap,
  ChevronDown,
  AlertCircle,
  BarChart3,
  Activity,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  getFlowAction,
  updateFlowAction,
  updateFlowStatusAction,
  createFlowStepAction,
  updateFlowStepAction,
  deleteFlowStepAction,
} from "@/server/actions/flows";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowStepType =
  | "SEND_MESSAGE"
  | "WAIT_DELAY"
  | "ADD_TAG"
  | "REMOVE_TAG"
  | "ADD_TO_LIST"
  | "REMOVE_FROM_LIST"
  | "BRANCH_CONDITION"
  | "UPDATE_CONTACT"
  | "WAIT_FOR_REPLY";

type FlowStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

interface FlowStep {
  id: string;
  flowId: string;
  type: FlowStepType;
  config: Record<string, any>;
  position: number;
  parentStepId: string | null;
  yesStepId: string | null;
  noStepId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Flow {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  triggerConfig: Record<string, any>;
  status: FlowStatus;
  steps: FlowStep[];
  createdBy: { id: string; name: string } | null;
  _count: { executions: number };
  stats: {
    total: number;
    active: number;
    completed: number;
    failed: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Step type metadata
// ---------------------------------------------------------------------------

const STEP_TYPES: {
  type: FlowStepType;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}[] = [
  {
    type: "SEND_MESSAGE",
    label: "Send Message",
    icon: MessageSquare,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    type: "WAIT_DELAY",
    label: "Wait / Delay",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    type: "ADD_TAG",
    label: "Add Tag",
    icon: Tag,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/40",
  },
  {
    type: "REMOVE_TAG",
    label: "Remove Tag",
    icon: X,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/40",
  },
  {
    type: "ADD_TO_LIST",
    label: "Add to List",
    icon: ListPlus,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
  },
  {
    type: "BRANCH_CONDITION",
    label: "Branch (If/Else)",
    icon: GitBranch,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/40",
  },
  {
    type: "WAIT_FOR_REPLY",
    label: "Wait for Reply",
    icon: MessageCircle,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/40",
  },
  {
    type: "UPDATE_CONTACT",
    label: "Update Contact",
    icon: UserCog,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
  },
];

function getStepMeta(type: FlowStepType) {
  return STEP_TYPES.find((s) => s.type === type) || STEP_TYPES[0];
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  FlowStatus,
  { label: string; variant: "success" | "warning" | "secondary" | "outline"; bannerClass: string }
> = {
  ACTIVE: {
    label: "This flow is Active",
    variant: "success",
    bannerClass: "bg-success/10 text-success border-success/20",
  },
  PAUSED: {
    label: "This flow is Paused",
    variant: "warning",
    bannerClass: "bg-warning/10 text-warning border-warning/20",
  },
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    bannerClass: "bg-muted text-muted-foreground border-border",
  },
  ARCHIVED: {
    label: "Archived",
    variant: "outline",
    bannerClass: "bg-muted text-muted-foreground border-border",
  },
};

// ---------------------------------------------------------------------------
// Trigger display
// ---------------------------------------------------------------------------

function getTriggerLabel(trigger: string, config: Record<string, any>): string {
  switch (trigger) {
    case "KEYWORD":
      return `When keyword "${config.keyword || "..."}" is received`;
    case "TAG_ADDED":
      return `When tag "${config.tag || "..."}" is added`;
    case "LIST_JOINED":
      return `When contact joins list "${config.list || "..."}"`;
    case "CONTACT_CREATED":
      return "When a new contact is created";
    case "MANUAL":
      return "Manually triggered";
    default:
      return trigger;
  }
}

// ---------------------------------------------------------------------------
// Step config summary
// ---------------------------------------------------------------------------

function getStepSummary(step: FlowStep): string {
  const c = step.config || {};
  switch (step.type) {
    case "SEND_MESSAGE": {
      const msg = (c.message as string) || "";
      return msg.length > 60 ? `Send: "${msg.slice(0, 60)}..."` : msg ? `Send: "${msg}"` : "Send message (not configured)";
    }
    case "WAIT_DELAY": {
      const amount = c.amount || c.delay || 0;
      const unit = c.unit || "hours";
      return amount ? `Wait ${amount} ${unit}` : "Wait (not configured)";
    }
    case "ADD_TAG":
      return c.tag ? `Add tag: "${c.tag}"` : "Add tag (not configured)";
    case "REMOVE_TAG":
      return c.tag ? `Remove tag: "${c.tag}"` : "Remove tag (not configured)";
    case "ADD_TO_LIST":
      return c.list ? `Add to list: "${c.list}"` : "Add to list (not configured)";
    case "REMOVE_FROM_LIST":
      return c.list ? `Remove from list: "${c.list}"` : "Remove from list (not configured)";
    case "BRANCH_CONDITION": {
      const field = c.field || "...";
      const op = c.operator || "equals";
      const val = c.value || "...";
      return `If ${field} ${op} "${val}"`;
    }
    case "WAIT_FOR_REPLY": {
      const timeout = c.timeout || "";
      const kw = c.keyword || "";
      let s = "Wait for reply";
      if (timeout) s += ` (${timeout}h timeout)`;
      if (kw) s += ` matching "${kw}"`;
      return s;
    }
    case "UPDATE_CONTACT": {
      const field = c.field || "...";
      const val = c.value || "...";
      return `Set ${field} = "${val}"`;
    }
    default:
      return step.type;
  }
}

// ===========================================================================
// Main page component
// ===========================================================================

export default function FlowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  // Core state
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState("edit");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  // Step config editing
  const [stepConfig, setStepConfig] = useState<Record<string, any>>({});

  // Insert step position tracking
  const [insertAtPosition, setInsertAtPosition] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadFlow = useCallback(async () => {
    try {
      const data = await getFlowAction(flowId);
      if (!data) {
        router.push("/flows");
        return;
      }
      setFlow(data as any);
      setNameValue(data.name);
    } catch (err: any) {
      setError(err.message || "Failed to load flow");
    } finally {
      setLoading(false);
    }
  }, [flowId, router]);

  useEffect(() => {
    loadFlow();
  }, [loadFlow]);

  // -------------------------------------------------------------------------
  // When a step is selected, populate the config editor
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!selectedStepId || !flow) {
      setStepConfig({});
      return;
    }
    const step = flow.steps.find((s) => s.id === selectedStepId);
    if (step) {
      setStepConfig({ ...step.config });
    }
  }, [selectedStepId, flow]);

  // -------------------------------------------------------------------------
  // Flow actions
  // -------------------------------------------------------------------------

  async function handleSaveName() {
    if (!flow || !nameValue.trim()) return;
    setSaving(true);
    try {
      await updateFlowAction(flow.id, { name: nameValue.trim() });
      setFlow({ ...flow, name: nameValue.trim() });
      setEditingName(false);
    } catch (err: any) {
      setError(err.message || "Failed to update name");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: FlowStatus) {
    if (!flow) return;
    const confirmMessages: Record<string, string> = {
      ACTIVE: "Activate this flow? It will start processing triggers.",
      PAUSED: "Pause this flow? Active executions will be paused.",
      DRAFT: "Move this flow back to Draft?",
    };
    if (confirmMessages[newStatus] && !confirm(confirmMessages[newStatus])) return;

    setSaving(true);
    try {
      await updateFlowStatusAction(flow.id, newStatus);
      await loadFlow();
    } catch (err: any) {
      setError(err.message || "Failed to change status");
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------------------------
  // Step actions
  // -------------------------------------------------------------------------

  async function handleAddStep(type: FlowStepType, position?: number) {
    if (!flow) return;
    setSaving(true);
    try {
      const newStep = await createFlowStepAction(flow.id, {
        type,
        config: {},
        position: position ?? undefined,
      });
      await loadFlow();
      setSelectedStepId(newStep.id);
      setInsertAtPosition(null);
    } catch (err: any) {
      setError(err.message || "Failed to add step");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStepConfig() {
    if (!selectedStepId) return;
    setSaving(true);
    try {
      await updateFlowStepAction(selectedStepId, { config: stepConfig });
      await loadFlow();
    } catch (err: any) {
      setError(err.message || "Failed to save step");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStep(stepId: string) {
    if (!confirm("Delete this step?")) return;
    setSaving(true);
    try {
      await deleteFlowStepAction(stepId);
      if (selectedStepId === stepId) {
        setSelectedStepId(null);
      }
      await loadFlow();
    } catch (err: any) {
      setError(err.message || "Failed to delete step");
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const selectedStep = flow?.steps.find((s) => s.id === selectedStepId) || null;
  const statusConfig = flow ? STATUS_CONFIG[flow.status] : STATUS_CONFIG.DRAFT;

  // -------------------------------------------------------------------------
  // Loading / Error states
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading flow...</p>
      </div>
    );
  }

  if (error && !flow) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
            {error}
          </div>
          <Button
            onClick={() => {
              setError("");
              setLoading(true);
              loadFlow();
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!flow) return null;

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* ----------------------------------------------------------------- */}
      {/* Top Bar */}
      {/* ----------------------------------------------------------------- */}
      <div className="shrink-0 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: back + name + status */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/flows")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Editable name */}
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="h-8 w-64"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") {
                      setEditingName(false);
                      setNameValue(flow.name);
                    }
                  }}
                />
                <Button size="sm" variant="ghost" onClick={handleSaveName} disabled={saving}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingName(false);
                    setNameValue(flow.name);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-2 text-lg font-semibold hover:text-primary truncate"
                onClick={() => setEditingName(true)}
              >
                {flow.name}
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}

            {/* Status banner */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${statusConfig.bannerClass}`}
            >
              {flow.status === "ACTIVE" && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
              )}
              {statusConfig.label}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {flow.status === "DRAFT" && (
              <Button onClick={() => handleStatusChange("ACTIVE")} disabled={saving}>
                <Play className="h-4 w-4 mr-1" />
                Activate
              </Button>
            )}
            {flow.status === "ACTIVE" && (
              <Button
                variant="outline"
                onClick={() => handleStatusChange("PAUSED")}
                disabled={saving}
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
            )}
            {flow.status === "PAUSED" && (
              <>
                <Button onClick={() => handleStatusChange("ACTIVE")} disabled={saving}>
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("DRAFT")}
                  disabled={saving}
                >
                  Move to Draft
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="shrink-0 mx-4 mt-3 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2"
            onClick={() => setError("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Tabs */}
      {/* ----------------------------------------------------------------- */}
      <div className="shrink-0 px-4 pt-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="edit">Edit Flow</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Tab content */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === "edit" ? (
        <EditFlowTab
          flow={flow}
          selectedStepId={selectedStepId}
          selectedStep={selectedStep}
          stepConfig={stepConfig}
          setStepConfig={setStepConfig}
          insertAtPosition={insertAtPosition}
          setInsertAtPosition={setInsertAtPosition}
          saving={saving}
          onSelectStep={setSelectedStepId}
          onAddStep={handleAddStep}
          onSaveStepConfig={handleSaveStepConfig}
          onDeleteStep={handleDeleteStep}
        />
      ) : (
        <AnalyticsTab flow={flow} />
      )}
    </div>
  );
}

// ===========================================================================
// Edit Flow Tab
// ===========================================================================

function EditFlowTab({
  flow,
  selectedStepId,
  selectedStep,
  stepConfig,
  setStepConfig,
  insertAtPosition,
  setInsertAtPosition,
  saving,
  onSelectStep,
  onAddStep,
  onSaveStepConfig,
  onDeleteStep,
}: {
  flow: Flow;
  selectedStepId: string | null;
  selectedStep: FlowStep | null;
  stepConfig: Record<string, any>;
  setStepConfig: (c: Record<string, any>) => void;
  insertAtPosition: number | null;
  setInsertAtPosition: (p: number | null) => void;
  saving: boolean;
  onSelectStep: (id: string | null) => void;
  onAddStep: (type: FlowStepType, position?: number) => void;
  onSaveStepConfig: () => void;
  onDeleteStep: (id: string) => void;
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ----- Left sidebar: step palette ----- */}
      <div className="hidden md:flex flex-col w-[250px] shrink-0 border-r bg-card overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Add Step
          </h3>
          <div className="space-y-1.5">
            {STEP_TYPES.map((st) => {
              const Icon = st.icon;
              return (
                <button
                  key={st.type}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors text-left group"
                  onClick={() => {
                    if (insertAtPosition !== null) {
                      onAddStep(st.type, insertAtPosition);
                    } else {
                      onAddStep(st.type);
                    }
                  }}
                  disabled={saving}
                >
                  <div
                    className={`flex items-center justify-center h-8 w-8 rounded-md ${st.bgColor} ${st.color} shrink-0`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="truncate">{st.label}</span>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Insertion position indicator */}
        {insertAtPosition !== null && (
          <div className="mx-4 mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
            <span className="font-medium">Inserting at position {insertAtPosition}</span>
            <button
              className="ml-2 underline hover:no-underline"
              onClick={() => setInsertAtPosition(null)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ----- Center canvas ----- */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto py-8 px-4">
          {/* Trigger node */}
          <TriggerNode
            trigger={flow.trigger}
            triggerConfig={flow.triggerConfig}
          />

          {/* Connector from trigger */}
          {flow.steps.length > 0 && <VerticalConnector />}

          {/* Step nodes */}
          {flow.steps
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((step, idx, arr) => (
              <div key={step.id}>
                <StepNode
                  step={step}
                  isSelected={step.id === selectedStepId}
                  onSelect={() =>
                    onSelectStep(step.id === selectedStepId ? null : step.id)
                  }
                  onDelete={() => onDeleteStep(step.id)}
                />

                {/* Insert button between nodes */}
                <InsertButton
                  position={step.position + 1}
                  isActive={insertAtPosition === step.position + 1}
                  onClick={() =>
                    setInsertAtPosition(
                      insertAtPosition === step.position + 1
                        ? null
                        : step.position + 1
                    )
                  }
                />

                {/* Connector to next */}
                {idx < arr.length - 1 && <VerticalConnector short />}
              </div>
            ))}

          {/* Insert button after last step (or after trigger if no steps) */}
          {flow.steps.length === 0 && (
            <InsertButton
              position={0}
              isActive={insertAtPosition === 0}
              onClick={() =>
                setInsertAtPosition(insertAtPosition === 0 ? null : 0)
              }
            />
          )}

          {/* End node */}
          <VerticalConnector />
          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground text-sm">
              <CheckCircle2 className="h-4 w-4" />
              End
            </div>
          </div>

          {/* Mobile add step section */}
          <div className="md:hidden mt-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Add Step
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {STEP_TYPES.map((st) => {
                const Icon = st.icon;
                return (
                  <button
                    key={st.type}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border hover:bg-accent transition-colors"
                    onClick={() => onAddStep(st.type)}
                    disabled={saving}
                  >
                    <Icon className={`h-4 w-4 ${st.color}`} />
                    <span className="truncate">{st.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ----- Right sidebar: step config ----- */}
      {selectedStep && (
        <StepConfigPanel
          step={selectedStep}
          config={stepConfig}
          setConfig={setStepConfig}
          saving={saving}
          onSave={onSaveStepConfig}
          onDelete={() => onDeleteStep(selectedStep.id)}
          onClose={() => onSelectStep(null)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Trigger Node
// ===========================================================================

function TriggerNode({
  trigger,
  triggerConfig,
}: {
  trigger: string;
  triggerConfig: Record<string, any>;
}) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-sm rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-primary tracking-wider">
              Trigger
            </p>
            <p className="text-sm text-foreground truncate">
              {getTriggerLabel(trigger, triggerConfig)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Step Node
// ===========================================================================

function StepNode({
  step,
  isSelected,
  onSelect,
  onDelete,
}: {
  step: FlowStep;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const meta = getStepMeta(step.type);
  const Icon = meta.icon;

  return (
    <div className="flex justify-center">
      <div
        className={`
          w-full max-w-sm rounded-xl border-2 p-4 cursor-pointer transition-all group relative
          ${
            isSelected
              ? "border-primary shadow-md ring-2 ring-primary/20"
              : "border-border hover:border-primary/40 hover:shadow-sm"
          }
        `}
        onClick={onSelect}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center h-10 w-10 rounded-lg ${meta.bgColor} ${meta.color} shrink-0`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {meta.label}
            </p>
            <p className="text-sm text-foreground truncate">
              {getStepSummary(step)}
            </p>
          </div>
        </div>

        {/* Delete button on hover */}
        <button
          className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete step"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// Vertical Connector
// ===========================================================================

function VerticalConnector({ short }: { short?: boolean }) {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center">
        <div
          className={`w-0.5 bg-border ${short ? "h-3" : "h-6"}`}
        />
        <ChevronDown className="h-3 w-3 text-muted-foreground/50 -mt-0.5" />
      </div>
    </div>
  );
}

// ===========================================================================
// Insert Button (between nodes)
// ===========================================================================

function InsertButton({
  position,
  isActive,
  onClick,
}: {
  position: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-center py-1">
      <button
        className={`
          hidden md:flex items-center justify-center h-7 w-7 rounded-full border-2 border-dashed transition-all
          ${
            isActive
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/30 text-muted-foreground/50 hover:border-primary hover:text-primary hover:bg-primary/5"
          }
        `}
        onClick={onClick}
        title={`Insert step at position ${position}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ===========================================================================
// Step Config Panel (Right Sidebar)
// ===========================================================================

function StepConfigPanel({
  step,
  config,
  setConfig,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  step: FlowStep;
  config: Record<string, any>;
  setConfig: (c: Record<string, any>) => void;
  saving: boolean;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const meta = getStepMeta(step.type);
  const Icon = meta.icon;

  function updateConfig(key: string, value: any) {
    setConfig({ ...config, [key]: value });
  }

  return (
    <div className="w-[320px] shrink-0 border-l bg-card overflow-y-auto">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center h-8 w-8 rounded-md ${meta.bgColor} ${meta.color}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-sm">{meta.label}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* SEND_MESSAGE */}
        {step.type === "SEND_MESSAGE" && (
          <>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Type your message... Use {{first_name}}, {{last_name}} for merge fields"
                value={config.message || ""}
                onChange={(e) => updateConfig("message", e.target.value)}
                rows={5}
              />
              <div className="flex flex-wrap gap-1">
                {["{{first_name}}", "{{last_name}}", "{{phone}}"].map((tag) => (
                  <button
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground"
                    onClick={() =>
                      updateConfig("message", (config.message || "") + " " + tag)
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Media URL (optional)</Label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={config.mediaUrl || ""}
                onChange={(e) => updateConfig("mediaUrl", e.target.value)}
              />
            </div>
          </>
        )}

        {/* WAIT_DELAY */}
        {step.type === "WAIT_DELAY" && (
          <div className="space-y-2">
            <Label>Delay</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Amount"
                value={config.amount || config.delay || ""}
                onChange={(e) => updateConfig("amount", parseInt(e.target.value) || "")}
                className="w-24"
              />
              <Select
                value={config.unit || "hours"}
                onValueChange={(val) => updateConfig("unit", val)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ADD_TAG */}
        {step.type === "ADD_TAG" && (
          <div className="space-y-2">
            <Label>Tag Name</Label>
            <Input
              placeholder="e.g. engaged, vip, volunteer"
              value={config.tag || ""}
              onChange={(e) => updateConfig("tag", e.target.value)}
            />
          </div>
        )}

        {/* REMOVE_TAG */}
        {step.type === "REMOVE_TAG" && (
          <div className="space-y-2">
            <Label>Tag Name</Label>
            <Input
              placeholder="Tag to remove"
              value={config.tag || ""}
              onChange={(e) => updateConfig("tag", e.target.value)}
            />
          </div>
        )}

        {/* ADD_TO_LIST */}
        {step.type === "ADD_TO_LIST" && (
          <div className="space-y-2">
            <Label>Interest List Name</Label>
            <Input
              placeholder="e.g. Newsletter, Volunteers"
              value={config.list || ""}
              onChange={(e) => updateConfig("list", e.target.value)}
            />
          </div>
        )}

        {/* REMOVE_FROM_LIST */}
        {step.type === "REMOVE_FROM_LIST" && (
          <div className="space-y-2">
            <Label>Interest List Name</Label>
            <Input
              placeholder="List to remove from"
              value={config.list || ""}
              onChange={(e) => updateConfig("list", e.target.value)}
            />
          </div>
        )}

        {/* BRANCH_CONDITION */}
        {step.type === "BRANCH_CONDITION" && (
          <>
            <div className="space-y-2">
              <Label>Field</Label>
              <Select
                value={config.field || ""}
                onValueChange={(val) => updateConfig("field", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag">Tag</SelectItem>
                  <SelectItem value="list">Interest List</SelectItem>
                  <SelectItem value="first_name">First Name</SelectItem>
                  <SelectItem value="last_name">Last Name</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="zip">ZIP Code</SelectItem>
                  <SelectItem value="last_reply">Last Reply</SelectItem>
                  <SelectItem value="custom_field">Custom Field</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select
                value={config.operator || "equals"}
                onValueChange={(val) => updateConfig("operator", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Does Not Equal</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="not_contains">Does Not Contain</SelectItem>
                  <SelectItem value="is_empty">Is Empty</SelectItem>
                  <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {config.operator !== "is_empty" && config.operator !== "is_not_empty" && (
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  placeholder="Value to compare"
                  value={config.value || ""}
                  onChange={(e) => updateConfig("value", e.target.value)}
                />
              </div>
            )}
          </>
        )}

        {/* WAIT_FOR_REPLY */}
        {step.type === "WAIT_FOR_REPLY" && (
          <>
            <div className="space-y-2">
              <Label>Timeout (hours)</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 24"
                value={config.timeout || ""}
                onChange={(e) => updateConfig("timeout", parseInt(e.target.value) || "")}
              />
              <p className="text-xs text-muted-foreground">
                How long to wait for a reply before continuing.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Keyword Match (optional)</Label>
              <Input
                placeholder="e.g. YES, CONFIRM"
                value={config.keyword || ""}
                onChange={(e) => updateConfig("keyword", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Only continue if the reply contains this keyword.
              </p>
            </div>
          </>
        )}

        {/* UPDATE_CONTACT */}
        {step.type === "UPDATE_CONTACT" && (
          <>
            <div className="space-y-2">
              <Label>Field</Label>
              <Select
                value={config.field || ""}
                onValueChange={(val) => updateConfig("field", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_name">First Name</SelectItem>
                  <SelectItem value="last_name">Last Name</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="zip">ZIP Code</SelectItem>
                  <SelectItem value="custom_field">Custom Field</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                placeholder="New value"
                value={config.value || ""}
                onChange={(e) => updateConfig("value", e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer buttons */}
      <div className="p-4 border-t space-y-2">
        <Button className="w-full" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          variant="outline"
          className="w-full text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          disabled={saving}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete Step
        </Button>
      </div>
    </div>
  );
}

// ===========================================================================
// Analytics Tab
// ===========================================================================

function AnalyticsTab({ flow }: { flow: Flow }) {
  const stats = flow.stats;
  const hasExecutions = stats.total > 0;

  const statCards = [
    {
      label: "Total Executions",
      value: stats.total,
      icon: BarChart3,
      color: "text-foreground",
    },
    {
      label: "Active",
      value: stats.active,
      icon: Activity,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
      color: "text-success",
    },
    {
      label: "Failed",
      value: stats.failed,
      icon: XCircle,
      color: "text-destructive",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold">Flow Analytics</h2>

        {/* Stat cards grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
                    {stat.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty state */}
        {!hasExecutions && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-muted-foreground">
                  No executions yet. Activate your flow to start collecting data.
                </p>
                {flow.status === "DRAFT" && (
                  <p className="text-xs text-muted-foreground">
                    Add steps to your flow and activate it to begin.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Execution breakdown (if data exists) */}
        {hasExecutions && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execution Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Progress-style bars */}
                {[
                  { label: "Completed", value: stats.completed, total: stats.total, color: "bg-success" },
                  { label: "Active", value: stats.active, total: stats.total, color: "bg-blue-500" },
                  { label: "Failed", value: stats.failed, total: stats.total, color: "bg-destructive" },
                ].map((bar) => {
                  const pct = stats.total > 0 ? (bar.value / stats.total) * 100 : 0;
                  return (
                    <div key={bar.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{bar.label}</span>
                        <span className="font-medium">
                          {bar.value} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${bar.color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
