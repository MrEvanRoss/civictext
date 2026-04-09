"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  getScheduledCampaignsAction,
  rescheduleCampaignAction,
  cancelScheduledCampaignAction,
  sendNowAction,
} from "@/server/actions/campaigns";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Pencil,
  Calendar as CalendarIcon,
  X,
  Play,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  scheduledAt: string | Date;
  totalRecipients: number;
  segment: { name: string; contactCount: number | null } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  BROADCAST: "Broadcast",
  P2P: "Peer-to-Peer",
  DRIP: "Drip Sequence",
  AUTO_REPLY: "Auto-Reply",
  GOTV: "GOTV",
};

const TYPE_COLORS: Record<string, string> = {
  BROADCAST: "bg-blue-500",
  P2P: "bg-purple-500",
  DRIP: "bg-amber-500",
  AUTO_REPLY: "bg-emerald-500",
  GOTV: "bg-rose-500",
};

const TYPE_PILL_CLASSES: Record<string, string> = {
  BROADCAST: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  P2P: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  DRIP: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  AUTO_REPLY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  GOTV: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Date helpers (no external library)
// ---------------------------------------------------------------------------

function toDateKey(date: Date, timezone: string): string {
  // Format as YYYY-MM-DD in the org's timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function relativeTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff < 0;

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  if (days === 0 && hours === 0 && minutes < 2) {
    return isPast ? "just now" : "in a moment";
  }

  if (days === 0 && hours === 0) {
    return isPast ? `${minutes}m ago` : `in ${minutes}m`;
  }

  if (days === 0) {
    return isPast ? `${hours}h ago` : `in ${hours}h`;
  }

  if (days === 1) {
    const timeStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
    return isPast ? `yesterday at ${timeStr}` : `tomorrow at ${timeStr}`;
  }

  if (days < 7) {
    return isPast ? `${days} days ago` : `in ${days} days`;
  }

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return isPast ? `${weeks}w ago` : `in ${weeks}w`;
  }

  const months = Math.floor(days / 30);
  return isPast ? `${months}mo ago` : `in ${months}mo`;
}

/**
 * Build the calendar grid for a given month/year.
 * Returns an array of Date objects starting from the Sunday
 * of the first week through the Saturday of the last week.
 */
function buildCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from the Sunday of the first week
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  // End at the Saturday of the last week
  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

  const grid: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    grid.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Calendar Month View Component
// ---------------------------------------------------------------------------

function MonthCalendar({
  campaigns,
  timezone,
  month,
  year,
  onPrev,
  onNext,
}: {
  campaigns: ScheduledCampaign[];
  timezone: string;
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const router = useRouter();
  const grid = buildCalendarGrid(year, month);
  const todayKey = toDateKey(new Date(), timezone);

  // Group campaigns by date key
  const campaignsByDate: Record<string, ScheduledCampaign[]> = {};
  for (const c of campaigns) {
    const key = toDateKey(new Date(c.scheduledAt), timezone);
    if (!campaignsByDate[key]) campaignsByDate[key] = [];
    campaignsByDate[key].push(c);
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous month</span>
        </Button>
        <h2 className="text-lg font-semibold">
          {MONTH_NAMES[month]} {year}
        </h2>
        <Button variant="outline" size="sm" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next month</span>
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted/50 border-b">
          {DAY_HEADERS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {grid.map((date, i) => {
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            const isCurrentMonth = date.getMonth() === month;
            const isToday = dateKey === todayKey;
            const dayCampaigns = campaignsByDate[dateKey] || [];

            return (
              <div
                key={i}
                className={`min-h-[100px] border-b border-r p-1.5 ${
                  i % 7 === 0 ? "" : ""
                } ${isToday ? "ring-2 ring-primary ring-inset" : ""} ${
                  isCurrentMonth ? "bg-background" : "bg-muted/20"
                }`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    isCurrentMonth
                      ? isToday
                        ? "text-primary font-bold"
                        : "text-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayCampaigns.slice(0, 3).map((campaign) => (
                    <button
                      key={campaign.id}
                      onClick={() => router.push(`/campaigns/${campaign.id}`)}
                      className={`w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${
                        TYPE_PILL_CLASSES[campaign.type] ||
                        "bg-muted text-muted-foreground"
                      }`}
                      title={`${campaign.name} - ${formatTime(new Date(campaign.scheduledAt), timezone)}`}
                    >
                      {campaign.name}
                    </button>
                  ))}
                  {dayCampaigns.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1.5">
                      +{dayCampaigns.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ScheduledPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<ScheduledCampaign[]>([]);
  const [timezone, setTimezone] = useState("America/New_York");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "list">("month");

  // Calendar month state
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());

  // Reschedule dialog
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledCampaign | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<ScheduledCampaign | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Send-now confirmation
  const [sendNowTarget, setSendNowTarget] = useState<ScheduledCampaign | null>(null);
  const [sendingNow, setSendingNow] = useState(false);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getScheduledCampaignsAction(calMonth, calYear);
      setCampaigns(result.campaigns as unknown as ScheduledCampaign[]);
      setTimezone(result.timezone);
    } catch (err: unknown) {
      console.error("Failed to load scheduled campaigns:", err);
      toast.error("Failed to load scheduled campaigns");
    } finally {
      setLoading(false);
    }
  }, [calMonth, calYear]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Navigate months
  function prevMonth() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  }

  // Action handlers
  async function handleReschedule() {
    if (!rescheduleTarget || !rescheduleDate) return;
    setRescheduling(true);
    try {
      await rescheduleCampaignAction(rescheduleTarget.id, rescheduleDate);
      toast.success("Campaign rescheduled");
      setRescheduleTarget(null);
      setRescheduleDate("");
      loadCampaigns();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setRescheduling(false);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelScheduledCampaignAction(cancelTarget.id);
      toast.success("Campaign cancelled");
      setCancelTarget(null);
      loadCampaigns();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel campaign");
    } finally {
      setCancelling(false);
    }
  }

  async function handleSendNow() {
    if (!sendNowTarget) return;
    setSendingNow(true);
    try {
      await sendNowAction(sendNowTarget.id);
      toast.success("Campaign is now sending");
      setSendNowTarget(null);
      loadCampaigns();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send campaign");
    } finally {
      setSendingNow(false);
    }
  }

  const isEmpty = !loading && campaigns.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled</h1>
          <p className="text-muted-foreground">
            {loading ? "Loading..." : `${campaigns.length} scheduled campaign${campaigns.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as "month" | "list")}>
            <TabsList>
              <TabsTrigger value="month">
                <CalendarDays className="h-4 w-4 mr-1.5" />
                Month
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="h-4 w-4 mr-1.5" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="flex items-center justify-center h-24 w-24 rounded-2xl bg-muted/50 mb-6">
              <CalendarClock className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No campaigns scheduled</h2>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Schedule a campaign to see it appear here. You can view upcoming
              sends in a calendar or list format.
            </p>
            <Link href="/campaigns/new">
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Create Campaign
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && !isEmpty && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-24 ml-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month view */}
      {!loading && !isEmpty && view === "month" && (
        <MonthCalendar
          campaigns={campaigns}
          timezone={timezone}
          month={calMonth}
          year={calYear}
          onPrev={prevMonth}
          onNext={nextMonth}
        />
      )}

      {/* List view */}
      {!loading && !isEmpty && view === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th scope="col" className="text-left py-3 px-4 font-medium">
                      Campaign Name
                    </th>
                    <th scope="col" className="text-left py-3 px-4 font-medium">
                      Scheduled Date/Time
                    </th>
                    <th scope="col" className="text-left py-3 px-4 font-medium">
                      Type
                    </th>
                    <th scope="col" className="text-left py-3 px-4 font-medium">
                      Recipients
                    </th>
                    <th scope="col" className="text-left py-3 px-4 font-medium">
                      Status
                    </th>
                    <th scope="col" className="text-right py-3 px-4 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => {
                    const scheduledDate = new Date(campaign.scheduledAt);
                    return (
                      <tr
                        key={campaign.id}
                        className="border-b last:border-0 even:bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium">
                          <Link
                            href={`/campaigns/${campaign.id}`}
                            className="hover:underline"
                          >
                            {campaign.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span>{formatDateTime(scheduledDate, timezone)}</span>
                            <span className="text-xs text-muted-foreground">
                              {relativeTime(scheduledDate)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">
                            <span
                              aria-hidden="true"
                              className={`inline-block h-2 w-2 rounded-full mr-1.5 ${
                                TYPE_COLORS[campaign.type] || "bg-muted-foreground"
                              }`}
                            />
                            {TYPE_LABELS[campaign.type] || campaign.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {campaign.segment?.name || "No segment"}
                          {campaign.segment?.contactCount != null && (
                            <span className="ml-1">
                              ({campaign.segment.contactCount.toLocaleString()})
                            </span>
                          )}
                          {!campaign.segment && campaign.totalRecipients > 0 && (
                            <span>{campaign.totalRecipients.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="warning">
                            <span
                              aria-hidden="true"
                              className="inline-block h-2 w-2 rounded-full mr-1.5 bg-warning"
                            />
                            Scheduled
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(`/campaigns/${campaign.id}/edit`)
                              }
                              title="Edit campaign"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>

                            {/* Reschedule */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRescheduleTarget(campaign);
                                // Pre-fill with current scheduled date
                                const d = new Date(campaign.scheduledAt);
                                const local = new Date(
                                  d.getTime() - d.getTimezoneOffset() * 60000
                                );
                                setRescheduleDate(
                                  local.toISOString().slice(0, 16)
                                );
                              }}
                              title="Reschedule"
                            >
                              <CalendarIcon className="h-3.5 w-3.5" />
                              <span className="sr-only">Reschedule</span>
                            </Button>

                            {/* Cancel */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCancelTarget(campaign)}
                              title="Cancel campaign"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span className="sr-only">Cancel</span>
                            </Button>

                            {/* Send Now */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSendNowTarget(campaign)}
                              title="Send now"
                            >
                              <Play className="h-3.5 w-3.5" />
                              <span className="sr-only">Send now</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reschedule dialog */}
      <Dialog
        open={!!rescheduleTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRescheduleTarget(null);
            setRescheduleDate("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Campaign</DialogTitle>
            <DialogDescription>
              Choose a new date and time for &ldquo;{rescheduleTarget?.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label
              htmlFor="reschedule-datetime"
              className="text-sm font-medium mb-2 block"
            >
              New date and time
            </label>
            <Input
              id="reschedule-datetime"
              type="datetime-local"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRescheduleTarget(null);
                setRescheduleDate("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={!rescheduleDate || rescheduling}
            >
              {rescheduling ? "Rescheduling..." : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel &ldquo;{cancelTarget?.name}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              Keep Scheduled
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? "Cancelling..." : "Cancel Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Now confirmation */}
      <AlertDialog
        open={!!sendNowTarget}
        onOpenChange={(open) => {
          if (!open) setSendNowTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Now</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send &ldquo;{sendNowTarget?.name}&rdquo;
              immediately? This will start sending messages right away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingNow}>
              Keep Scheduled
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendNow}
              disabled={sendingNow}
            >
              {sendingNow ? "Starting..." : "Send Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
