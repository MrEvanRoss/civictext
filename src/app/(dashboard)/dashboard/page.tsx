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
} from "lucide-react";

const ONBOARDING_STEPS = [
  {
    key: "twilioSetup" as const,
    label: "Set up Twilio account",
    href: "/phone-numbers",
    description: "Connect your Twilio subaccount for messaging",
  },
  {
    key: "brandRegistered" as const,
    label: "Register for 10DLC",
    href: "/phone-numbers/register",
    description: "Complete brand and campaign registration",
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const allComplete = onboarding?.completedSteps === onboarding?.totalSteps;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {stats?.plan
            ? `${stats.plan.tier} plan \u00b7 ${stats.plan.monthlyAllotment.toLocaleString()} messages/month`
            : "Welcome to CivicText"}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.messagesSent?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.deliveryRate ? `${stats.deliveryRate}%` : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.deliveryRate ? "last 30 days" : "no data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeContacts?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">opted-in contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeCampaigns || "0"}
            </div>
            <p className="text-xs text-muted-foreground">currently sending</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Onboarding Checklist */}
        {onboarding && !allComplete && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Getting Started</CardTitle>
                  <CardDescription>
                    Complete these steps to start sending messages
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {onboarding.completedSteps}/{onboarding.totalSteps}
                </Badge>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${(onboarding.completedSteps / onboarding.totalSteps) * 100}%`,
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ONBOARDING_STEPS.map((step, i) => {
                  const done = onboarding[step.key];
                  return (
                    <Link
                      key={step.key}
                      href={step.href}
                      className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                        done
                          ? "bg-green-50 border border-green-200"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      {done ? (
                        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            done ? "text-green-700 line-through" : ""
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Campaigns</CardTitle>
                <CardDescription>Your latest campaign activity</CardDescription>
              </div>
              <Link href="/campaigns/new">
                <Button size="sm">New Campaign</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recentCampaigns?.length > 0 ? (
              <div className="space-y-3">
                {stats.recentCampaigns.map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.type} &middot;{" "}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
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
                      >
                        {c.status}
                      </Badge>
                      {c.sentCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {c.sentCount.toLocaleString()} sent
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No campaigns yet. Create your first campaign to get started.
                </p>
                <Link href="/campaigns/new">
                  <Button variant="outline" size="sm" className="mt-3">
                    Create Campaign
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions (shows when onboarding complete) */}
        {allComplete && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks at your fingertips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/campaigns/new">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Zap className="h-4 w-4" />
                    New Campaign
                  </Button>
                </Link>
                <Link href="/contacts/import">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Users className="h-4 w-4" />
                    Import Contacts
                  </Button>
                </Link>
                <Link href="/inbox">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <MessageSquare className="h-4 w-4" />
                    View Inbox
                  </Button>
                </Link>
                <Link href="/analytics">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Analytics
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
