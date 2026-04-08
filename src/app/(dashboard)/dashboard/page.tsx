"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  BarChart3,
  Upload,
} from "lucide-react";

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

function formatRate(cents: number): string {
  return Number(cents) % 1 === 0 ? String(cents) : Number(cents).toFixed(2);
}

function relativeTime(dateStr: string): string {
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48 mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48 mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accentClass || "bg-muted"}`}>
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

export default function DashboardPage() {
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getOnboardingStatusAction(), getDashboardStatsAction()])
      .then(([ob, st]) => {
        setOnboarding(ob);
        setStats(st);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const allComplete = onboarding?.completedSteps === onboarding?.totalSteps;
  const deliveryRate = stats?.deliveryRate ? Number(stats.deliveryRate) : null;

  // Delivery rate color
  const deliveryAccent =
    deliveryRate === null
      ? "bg-muted text-muted-foreground"
      : deliveryRate >= 95
      ? "bg-success/15 text-success"
      : deliveryRate >= 90
      ? "bg-warning/15 text-warning"
      : "bg-destructive/15 text-destructive";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {stats?.plan
            ? `Balance: $${stats.plan.balanceDollars} \u00b7 SMS: ${formatRate(stats.plan.smsRateCents)}\u00a2/seg \u00b7 MMS: ${formatRate(stats.plan.mmsRateCents)}\u00a2/msg`
            : "Welcome to CivicText"}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Messages Sent"
          value={stats?.messagesSent?.toLocaleString() || "0"}
          subtitle="last 30 days"
          icon={MessageSquare}
          accentClass="bg-primary/10 text-primary"
        />
        <StatCard
          title="Delivery Rate"
          value={deliveryRate ? `${deliveryRate}%` : "--"}
          subtitle={deliveryRate ? "last 30 days" : "no data yet"}
          icon={TrendingUp}
          accentClass={deliveryAccent}
        />
        <StatCard
          title="Active Contacts"
          value={stats?.activeContacts?.toLocaleString() || "0"}
          subtitle="opted-in contacts"
          icon={Users}
          accentClass="bg-info/10 text-info"
        />
        <StatCard
          title="Active Campaigns"
          value={stats?.activeCampaigns || "0"}
          subtitle="currently sending"
          icon={Zap}
          accentClass="bg-warning/10 text-warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Onboarding Checklist */}
        {onboarding && !allComplete && (
          <Card className="animate-slide-up">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Getting Started</CardTitle>
                  <CardDescription>
                    Complete these steps to start sending messages
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {onboarding.completedSteps}/{onboarding.totalSteps}
                </Badge>
              </div>
              <Progress
                value={(onboarding.completedSteps / onboarding.totalSteps) * 100}
                className="h-2 mt-2"
              />
            </CardHeader>
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
          </Card>
        )}

        {/* Recent Campaigns */}
        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Campaigns</CardTitle>
                <CardDescription>Your latest campaign activity</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/campaigns">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    View All
                  </Button>
                </Link>
                <Link href="/campaigns/new">
                  <Button size="sm">New Campaign</Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recentCampaigns?.length > 0 ? (
              <div className="space-y-2">
                {stats.recentCampaigns.map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          c.status === "COMPLETED"
                            ? "bg-success"
                            : c.status === "SENDING"
                            ? "bg-primary animate-pulse"
                            : c.status === "SCHEDULED"
                            ? "bg-warning"
                            : c.status === "DRAFT"
                            ? "bg-muted-foreground/40"
                            : "bg-destructive"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.type} &middot; {relativeTime(c.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.sentCount > 0 && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {c.sentCount.toLocaleString()} sent
                        </span>
                      )}
                      <Badge
                        variant={
                          c.status === "COMPLETED"
                            ? "success"
                            : c.status === "SENDING"
                            ? "default"
                            : c.status === "DRAFT"
                            ? "secondary"
                            : c.status === "FAILED" || c.status === "CANCELLED"
                            ? "destructive"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {c.status}
                      </Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium">No campaigns yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first campaign to start reaching voters.
                </p>
                <Link href="/campaigns/new">
                  <Button variant="outline" size="sm" className="mt-4">
                    Create Campaign
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions (shows when onboarding complete) */}
        {allComplete && (
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks at your fingertips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { href: "/campaigns/new", icon: Zap, label: "New Campaign", desc: "Create and send messages", accent: "text-primary" },
                  { href: "/contacts/import", icon: Upload, label: "Import Contacts", desc: "Upload a CSV file", accent: "text-info" },
                  { href: "/inbox", icon: Inbox, label: "View Inbox", desc: "Check conversations", accent: "text-warning" },
                  { href: "/analytics", icon: BarChart3, label: "Analytics", desc: "View performance", accent: "text-success" },
                ].map((action) => (
                  <Link key={action.href} href={action.href}>
                    <div className="p-4 rounded-lg border bg-card hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer">
                      <action.icon className={`h-5 w-5 ${action.accent} mb-2`} />
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
