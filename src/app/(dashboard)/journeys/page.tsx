"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  listFlowsAction,
  createFlowAction,
  updateFlowStatusAction,
  duplicateFlowAction,
  deleteFlowAction,
} from "@/server/actions/flows";
import { listInterestListsAction } from "@/server/actions/interest-lists";
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Archive,
  Trash2,
  Copy,
  MoreHorizontal,
  Pencil,
  MessageSquare,
  Tag,
  ListPlus,
  UserPlus,
  Zap,
  Activity,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowTrigger = "KEYWORD" | "TAG_ADDED" | "LIST_JOINED" | "CONTACT_CREATED" | "MANUAL";
type FlowStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

interface Flow {
  id: string;
  name: string;
  description: string | null;
  trigger: FlowTrigger;
  triggerConfig: Record<string, unknown>;
  status: FlowStatus;
  createdAt: string;
  _count: { steps: number; executions: number };
  createdBy: { id: string; name: string | null } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_OPTIONS: {
  value: FlowTrigger;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: "KEYWORD",
    label: "Keyword Received",
    description: "When a contact texts a specific keyword",
    icon: MessageSquare,
  },
  {
    value: "TAG_ADDED",
    label: "Tag Added",
    description: "When a tag is added to a contact",
    icon: Tag,
  },
  {
    value: "LIST_JOINED",
    label: "List Joined",
    description: "When a contact joins an interest list",
    icon: ListPlus,
  },
  {
    value: "CONTACT_CREATED",
    label: "Contact Created",
    description: "When a new contact is created",
    icon: UserPlus,
  },
  {
    value: "MANUAL",
    label: "Manual",
    description: "Manually triggered",
    icon: Zap,
  },
];

const STATUS_CONFIG: Record<
  FlowStatus,
  { variant: "secondary" | "success" | "warning" | "outline"; label: string }
> = {
  DRAFT: { variant: "secondary", label: "Draft" },
  ACTIVE: { variant: "success", label: "Active" },
  PAUSED: { variant: "warning", label: "Paused" },
  ARCHIVED: { variant: "outline", label: "Archived" },
};

function getTriggerIcon(trigger: FlowTrigger) {
  const opt = TRIGGER_OPTIONS.find((t) => t.value === trigger);
  return opt?.icon ?? GitBranch;
}

function getTriggerLabel(trigger: FlowTrigger) {
  return TRIGGER_OPTIONS.find((t) => t.value === trigger)?.label ?? trigger;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [interestLists, setInterestLists] = useState<any[]>([]);

  // Create form state
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<FlowTrigger>("KEYWORD");
  const [keyword, setKeyword] = useState("");
  const [tagName, setTagName] = useState("");
  const [listId, setListId] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
    variant?: "default" | "destructive";
  }>({ open: false, title: "", description: "", action: async () => {} });

  useEffect(() => {
    loadFlows();
    loadInterestLists();
  }, []);

  async function loadFlows() {
    setLoading(true);
    try {
      const data = await listFlowsAction();
      setFlows(data as any);
    } catch (err: any) {
      toast.error(err.message || "Failed to load journeys");
    } finally {
      setLoading(false);
    }
  }

  async function loadInterestLists() {
    try {
      const data = await listInterestListsAction();
      setInterestLists(data);
    } catch {
      // Non-critical, silently fail
    }
  }

  function resetCreateForm() {
    setName("");
    setTrigger("KEYWORD");
    setKeyword("");
    setTagName("");
    setListId("");
    setDescription("");
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const triggerConfig: Record<string, unknown> = {};
      if (trigger === "KEYWORD" && keyword.trim()) {
        triggerConfig.keyword = keyword.trim().toUpperCase();
      } else if (trigger === "TAG_ADDED" && tagName.trim()) {
        triggerConfig.tagName = tagName.trim();
      } else if (trigger === "LIST_JOINED" && listId) {
        triggerConfig.listId = listId;
        const list = interestLists.find((l) => l.id === listId);
        if (list) triggerConfig.listName = list.name;
      }

      await createFlowAction({
        name,
        trigger,
        triggerConfig,
        description: description || undefined,
      });
      resetCreateForm();
      setShowCreate(false);
      toast.success("Journey created successfully");
      await loadFlows();
    } catch (err: any) {
      toast.error(err.message || "Failed to create journey");
    } finally {
      setCreating(false);
    }
  }

  function confirmStatusChange(flowId: string, flowName: string, newStatus: FlowStatus) {
    const labels: Record<FlowStatus, string> = {
      ACTIVE: "activate",
      PAUSED: "pause",
      ARCHIVED: "archive",
      DRAFT: "move to draft",
    };
    setConfirmAction({
      open: true,
      title: `${labels[newStatus].charAt(0).toUpperCase() + labels[newStatus].slice(1)} "${flowName}"?`,
      description:
        newStatus === "ACTIVE"
          ? "This journey will begin triggering for matching contacts."
          : newStatus === "PAUSED"
            ? "This journey will stop triggering but can be reactivated later."
            : newStatus === "ARCHIVED"
              ? "This journey will be archived and stop processing. You can restore it to draft later."
              : "This journey will be returned to draft status.",
      action: async () => {
        try {
          await updateFlowStatusAction(flowId, newStatus);
          toast.success(`Journey ${labels[newStatus]}d`);
          await loadFlows();
        } catch (err: any) {
          toast.error(err.message || `Failed to ${labels[newStatus]} journey`);
        }
      },
    });
  }

  function confirmDelete(flowId: string, flowName: string) {
    setConfirmAction({
      open: true,
      title: `Delete "${flowName}"?`,
      description:
        "This action cannot be undone. The journey and all its steps will be permanently deleted.",
      variant: "destructive",
      action: async () => {
        try {
          await deleteFlowAction(flowId);
          toast.success("Journey deleted");
          await loadFlows();
        } catch (err: any) {
          toast.error(err.message || "Failed to delete journey");
        }
      },
    });
  }

  async function handleDuplicate(flowId: string) {
    try {
      await duplicateFlowAction(flowId);
      toast.success("Journey duplicated");
      await loadFlows();
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate journey");
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function getAvailableActions(flow: Flow) {
    const actions: {
      label: string;
      icon: React.ElementType;
      onClick: () => void;
      destructive?: boolean;
    }[] = [];

    // Edit is always available
    actions.push({
      label: "Edit",
      icon: Pencil,
      onClick: () => {
        // Navigate to journey detail/editor
        window.location.href = `/journeys/${flow.id}`;
      },
    });

    // Duplicate is always available
    actions.push({
      label: "Duplicate",
      icon: Copy,
      onClick: () => handleDuplicate(flow.id),
    });

    switch (flow.status) {
      case "DRAFT":
        if (flow._count.steps > 0) {
          actions.push({
            label: "Activate",
            icon: Play,
            onClick: () => confirmStatusChange(flow.id, flow.name, "ACTIVE"),
          });
        }
        actions.push({
          label: "Delete",
          icon: Trash2,
          onClick: () => confirmDelete(flow.id, flow.name),
          destructive: true,
        });
        break;
      case "ACTIVE":
        actions.push({
          label: "Pause",
          icon: Pause,
          onClick: () => confirmStatusChange(flow.id, flow.name, "PAUSED"),
        });
        actions.push({
          label: "Archive",
          icon: Archive,
          onClick: () => confirmStatusChange(flow.id, flow.name, "ARCHIVED"),
        });
        break;
      case "PAUSED":
        actions.push({
          label: "Activate",
          icon: Play,
          onClick: () => confirmStatusChange(flow.id, flow.name, "ACTIVE"),
        });
        actions.push({
          label: "Archive",
          icon: Archive,
          onClick: () => confirmStatusChange(flow.id, flow.name, "ARCHIVED"),
        });
        actions.push({
          label: "Delete",
          icon: Trash2,
          onClick: () => confirmDelete(flow.id, flow.name),
          destructive: true,
        });
        break;
      case "ARCHIVED":
        // Can only restore to draft
        actions.push({
          label: "Restore to Draft",
          icon: GitBranch,
          onClick: () => confirmStatusChange(flow.id, flow.name, "DRAFT"),
        });
        break;
    }

    return actions;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journeys</h1>
          <p className="text-muted-foreground">
            Automate multi-step messaging sequences
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Journey
        </Button>
      </div>

      {/* Create Journey Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) resetCreateForm();
          setShowCreate(open);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create Journey</DialogTitle>
            <DialogDescription>
              Set up an automated messaging sequence triggered by an event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="flowName">Name *</Label>
              <Input
                id="flowName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Welcome Series, Event Follow-up"
              />
            </div>

            {/* Trigger Type */}
            <div className="space-y-2">
              <Label>Trigger *</Label>
              <Select
                value={trigger}
                onValueChange={(v) => setTrigger(v as FlowTrigger)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a trigger" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            -- {opt.description}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional Trigger Config */}
            {trigger === "KEYWORD" && (
              <div className="space-y-2">
                <Label htmlFor="triggerKeyword">Keyword</Label>
                <Input
                  id="triggerKeyword"
                  value={keyword}
                  onChange={(e) =>
                    setKeyword(e.target.value.toUpperCase().replace(/\s/g, ""))
                  }
                  placeholder="e.g., INFO, VOLUNTEER"
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  The journey triggers when a contact texts this keyword.
                </p>
              </div>
            )}

            {trigger === "TAG_ADDED" && (
              <div className="space-y-2">
                <Label htmlFor="triggerTag">Tag Name</Label>
                <Input
                  id="triggerTag"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g., volunteer, donor"
                />
                <p className="text-xs text-muted-foreground">
                  The journey triggers when this tag is added to a contact.
                </p>
              </div>
            )}

            {trigger === "LIST_JOINED" && (
              <div className="space-y-2">
                <Label>Interest List</Label>
                {interestLists.length > 0 ? (
                  <Select value={listId} onValueChange={setListId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an interest list" />
                    </SelectTrigger>
                    <SelectContent>
                      {interestLists.map((list: any) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                    No interest lists available. Create one in Interest Lists first.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  The journey triggers when a contact joins this list.
                </p>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="flowDescription">Description (optional)</Label>
              <Textarea
                id="flowDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this flow does..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetCreateForm();
                setShowCreate(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
            >
              {creating ? "Creating..." : "Create Journey"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Alert Dialog */}
      <AlertDialog
        open={confirmAction.open}
        onOpenChange={(open) =>
          setConfirmAction((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmAction.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              onClick={async () => {
                await confirmAction.action();
                setConfirmAction((prev) => ({ ...prev, open: false }));
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Flow Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-48 mt-2" />
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : flows.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <GitBranch className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium mb-1">No journeys yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Journeys let you automate multi-step messaging sequences. Create
              your first journey to get started with keyword responses, welcome
              series, and more.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Journey
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Flow Grid */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => {
            const TriggerIcon = getTriggerIcon(flow.trigger);
            const statusCfg = STATUS_CONFIG[flow.status];
            const actions = getAvailableActions(flow);
            const isArchived = flow.status === "ARCHIVED";

            return (
              <Card
                key={flow.id}
                className={`group relative transition-colors hover:border-primary/50 ${
                  isArchived ? "opacity-70" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/journeys/${flow.id}`}
                        className={`text-base font-semibold hover:underline block truncate ${
                          isArchived ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {flow.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusCfg.variant} className="text-xs">
                        {statusCfg.label}
                      </Badge>

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {actions.map((action, idx) => {
                            const ActionIcon = action.icon;
                            const isDestructive = action.destructive;
                            // Add separator before destructive actions
                            const prevAction = idx > 0 ? actions[idx - 1] : null;
                            const needsSeparator =
                              isDestructive && prevAction && !prevAction.destructive;

                            return (
                              <div key={action.label}>
                                {needsSeparator && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick();
                                  }}
                                  className={
                                    isDestructive
                                      ? "text-destructive focus:text-destructive"
                                      : ""
                                  }
                                >
                                  <ActionIcon className="h-4 w-4 mr-2" />
                                  {action.label}
                                </DropdownMenuItem>
                              </div>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Trigger Badge */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <TriggerIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {getTriggerLabel(flow.trigger)}
                    </span>
                    {flow.trigger === "KEYWORD" &&
                      (flow.triggerConfig as any)?.keyword && (
                        <Badge variant="outline" className="text-xs font-mono ml-1 py-0">
                          {(flow.triggerConfig as any).keyword}
                        </Badge>
                      )}
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      {/* Step Count */}
                      <div className="flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5" />
                        <span>
                          {flow._count.steps}{" "}
                          {flow._count.steps === 1 ? "step" : "steps"}
                        </span>
                      </div>

                      {/* Execution Count */}
                      <div className="flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5" />
                        <span>
                          {flow._count.executions}{" "}
                          {flow._count.executions === 1 ? "run" : "runs"}
                        </span>
                      </div>
                    </div>

                    {/* Created Date */}
                    <span className="text-xs">
                      {new Date(flow.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
