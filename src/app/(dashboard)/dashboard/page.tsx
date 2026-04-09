"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBillingAccess } from "@/hooks/use-billing-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getOnboardingStatusAction,
  getDashboardStatsAction,
  type OnboardingStatus,
} from "@/server/actions/onboarding";
import {
  MessageSquare,
  TrendingUp,
  Users,
  Zap,
  CheckCircle,
  Circle,
  ArrowRight,
  Inbox,
  Upload,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  UserPlus,
  Send,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  sentCount: number;
  deliveredCount: number;
  createdAt: Date | string;
}

interface ScheduledCampaign {
  id: string;
  name: string;
  scheduledAt: Date | string | null;
  type: string;
  segmentId: string | null;
  totalRecipients: number;
}

interface ActivityItem {
  type: "campaign_sent" | "contact_joined";
  description: string;
  timestamp: Date | string;
  linkTo?: string;
}

interface DashboardStats {
  messagesSent: number;
  messagesToday: number;
  responsesToday: number;
  deliveryRate: string | null;
  activeContacts: number;
  activeCampaigns: number;
  pendingConversations: number;
  recentCampaigns: RecentCampaign[];
  scheduledCampaigns: ScheduledCampaign[];
  recentActivity: ActivityItem[];
  plan: {
    balanceCents: number;
    balanceDollars: string;
    smsRateCents: number;
    mmsRateCents: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ONBOARDING_STEPS = [
  {
    key: "twilioSetup" as const,
    label: "Set up messaging account",
    href: "/phone-numbers",
    description: "Configure your messaging service",
  },
  {
    key: "brandRegistered" as const,
    label: "Register your brand",
    href: "/phone-numbers/register",
    description: "Complete brand and campaign registration with carriers",
  },
  {
    key: "phoneNumber" as const,
    label: "Get a phone number",
    href: "/phone-numbers",
    description: "Provision at least one active phone number",
  },
  {
    key: "contactsImported" as const,
    label: "Import contacts",
    href: "/contacts/import",
    description: "Upload your contact list via CSV",
  },
  {
    key: "firstCampaign" as const,
    label: "Create your first campaign",
    href: "/campaigns/new",
    description: "Send your first text message campaign",
  },
];

const LOW_BALANCE_THRESHOLD_CENTS = 500; // $5.00

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRate(cents: number): string {
  return Number(cents) % 1 === 0 ? String(cents) : Number(cents).toFixed(2);
}

function relativeTime(dateStr: Date | string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatScheduledDate(dateStr: Date | string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at ${timeStr}`;
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-16 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-36 rounded-md" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48 mt-1" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  accentClass?: string;
}) {
  return (
    <Card className="animate-fade-in hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${accentClass || "bg-muted"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function OnboardingChecklist({
  onboarding,
}: {
  onboarding: OnboardingStatus;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card className="animate-slide-up border-primary/20">
      <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>Getting Started</CardTitle>
              <Badge variant="secondary" className="font-mono">
                {onboarding.completedSteps}/{onboarding.totalSteps}
              </Badge>
            </div>
            <CardDescription className="mt-1">
              Complete these steps to start sending messages
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Progress
          value={(onboarding.completedSteps / onboarding.totalSteps) * 100}
          className="h-2 mt-2"
        />
      </CardHeader>
      {open && (
        <CardContent>
          <div className="space-y-2">
            {ONBOARDING_STEPS.map((step) => {
              const done = onboarding[step.key];
              return (
                <Link
                  key={step.key}
                  href={step.href}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-150 ${
                    done
                      ? "bg-success/10 border border-success/20"
                      : "bg-muted/40 hover:bg-muted border border-transparent"
                  }`}
                >
                  {done ? (
                    <CheckCircle className="h-5 w-5 text-success shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        done ? "text-success line-through" : ""
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  {!done && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function QuickActions({ pendingConversations }: { pendingConversations: number }) {
  return (
    <div className="flex gap-3 flex-wrap">
      <Link href="/campaigns/new">
        <Button className="gap-2">
          <Zap className="h-4 w-4" />
          New Campaign
        </Button>
      </Link>
      <Link href="/journeys">
        <Button variant="outline" className="gap-2">
          <Send className="h-4 w-4" />
          New Journey
        </Button>
      </Link>
      <Link href="/inbox">
        <Button variant="outline" className="gap-2 relative">
          <Inbox className="h-4 w-4" />
          View Inbox
          {pendingConversations > 0 && (
            <Badge className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] font-bold">
              {pendingConversations > 99 ? "99+" : pendingConversations}
            </Badge>
          )}
        </Button>
      </Link>
      <Link href="/contacts/import">
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import Contacts
        </Button>
      </Link>
    </div>
  );
}

function RecentActivityFeed({ activity }: { activity: ActivityItem[] }) {
  return (
    <Card className="animate-slide-up">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest events across your account</CardDescription>
          </div>
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {activity.length > 0 ? (
          <div className="space-y-1">
            {activity.map((item, i) => (
              <div key={i} className="group">
                {item.linkTo ? (
                  <Link
                    href={item.linkTo}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <ActivityIcon type={item.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(item.timestamp)}
                      </p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <ActivityIcon type={item.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(item.timestamp)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">
              Activity will appear here as you send campaigns and receive opt-ins.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "campaign_sent":
      return (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Send className="h-4 w-4 text-primary" />
        </div>
      );
    case "contact_joined":
      return (
        <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
          <UserPlus className="h-4 w-4 text-success" />
        </div>
      );
    default:
      return (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Circle className="h-4 w-4 text-muted-foreground" />
        </div>
      );
  }
}

function UpcomingCampaigns({
  campaigns,
}: {
  campaigns: ScheduledCampaign[];
}) {
  return (
    <Card className="animate-slide-up">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Upcoming</CardTitle>
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All
            </Button>
          </Link>
        </div>
        <CardDescription>Scheduled for the next 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        {campaigns.length > 0 ? (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted transition-colors group"
              >
                <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="h-4 w-4 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.scheduledAt
                      ? formatScheduledDate(c.scheduledAt)
                      : "Not scheduled"}
                  </p>
                  {c.totalRecipients > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {c.totalRecipients.toLocaleString()} recipients
                    </p>
                  )}
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-2">
              <Calendar className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground">
              No upcoming campaigns
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertCards({
  plan,
}: {
  plan: DashboardStats["plan"];
}) {
  const alerts: { title: string; message: string; variant: "warning" | "destructive" }[] = [];

  if (plan && plan.balanceCents < LOW_BALANCE_THRESHOLD_CENTS) {
    const isZero = plan.balanceCents <= 0;
    alerts.push({
      title: isZero ? "No balance remaining" : "Low balance",
      message: isZero
        ? "Your balance is $0.00. Add funds to continue sending messages."
        : `Your balance is $${plan.balanceDollars}. Consider adding funds soon.`,
      variant: isZero ? "destructive" : "warning",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <Card
          key={i}
          className={`border ${
            alert.variant === "destructive"
              ? "border-destructive/30 bg-destructive/5"
              : "border-warning/30 bg-warning/5"
          }`}
        >
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                alert.variant === "destructive"
                  ? "text-destructive"
                  : "text-warning"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  alert.variant === "destructive"
                    ? "text-destructive"
                    : "text-warning"
                }`}
              >
                {alert.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {alert.message}
              </p>
            </div>
            <Link href="/billing">
              <Button size="sm" variant="outline" className="shrink-0">
                Add Funds
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const canViewBilling = useBillingAccess();

  useEffect(() => {
    Promise.all([getOnboardingStatusAction(), getDashboardStatsAction()])
      .then(([ob, st]) => {
        setOnboarding(ob);
        setStats(st as DashboardStats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const allComplete = onboarding?.completedSteps === onboarding?.totalSteps;
  const responseRate =
    stats && stats.messagesToday > 0
      ? ((stats.responsesToday / stats.messagesToday) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {canViewBilling && stats?.plan
            ? `Balance: $${stats.plan.balanceDollars} \u00b7 SMS: ${formatRate(stats.plan.smsRateCents)}\u00a2/seg \u00b7 MMS: ${formatRate(stats.plan.mmsRateCents)}\u00a2/msg`
            : "Welcome to CivicText"}
        </p>
      </div>

      {/* Onboarding checklist (collapsible, shown when incomplete) */}
      {onboarding && !allComplete && (
        <OnboardingChecklist onboarding={onboarding} />
      )}

      {/* Quick Stats Row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value={stats?.activeContacts?.toLocaleString() || "0"}
          subtitle="opted-in contacts"
          icon={Users}
          accentClass="bg-info/10 text-info"
        />
        <StatCard
          title="Messages Today"
          value={stats?.messagesToday?.toLocaleString() || "0"}
          subtitle="sent today"
          icon={MessageSquare}
          accentClass="bg-primary/10 text-primary"
        />
        <StatCard
          title="Response Rate Today"
          value={responseRate ? `${responseRate}%` : "--"}
          subtitle={
            responseRate
              ? `${stats?.responsesToday ?? 0} replies`
              : "no messages yet today"
          }
          icon={TrendingUp}
          accentClass={
            responseRate === null
              ? "bg-muted text-muted-foreground"
              : Number(responseRate) >= 10
                ? "bg-success/15 text-success"
                : "bg-warning/15 text-warning"
          }
        />
        <StatCard
          title="Pending Conversations"
          value={String(stats?.pendingConversations ?? 0)}
          subtitle="open inbox items"
          icon={Inbox}
          accentClass="bg-warning/10 text-warning"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions pendingConversations={stats?.pendingConversations ?? 0} />

      {/* Two-column layout: Activity + Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Recent Activity */}
        <div className="lg:col-span-2">
          <RecentActivityFeed activity={stats?.recentActivity ?? []} />
        </div>

        {/* Right column: Upcoming + Alerts */}
        <div className="space-y-6">
          <UpcomingCampaigns campaigns={stats?.scheduledCampaigns ?? []} />
          {canViewBilling && <AlertCards plan={stats?.plan ?? null} />}
        </div>
      </div>
    </div>
  );
}
