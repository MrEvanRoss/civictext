"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBillingOverviewAction } from "@/server/actions/billing";
import { CreditCard, TrendingUp, AlertTriangle } from "lucide-react";

const TIER_LABELS: Record<string, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
  CUSTOM: "Custom",
};

export default function BillingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBilling();
  }, []);

  async function loadBilling() {
    try {
      const result = await getBillingOverviewAction();
      setData(result);
    } catch (err) {
      console.error("Failed to load billing:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const plan = data?.plan;
  const usage = data?.usage || { usage: 0, quota: 0, percentUsed: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your messaging plan and usage.
        </p>
      </div>

      {/* Alert Banner */}
      {data?.alertThreshold && data.alertThreshold >= 75 && (
        <div
          className={`rounded-md p-4 flex items-center gap-3 ${
            data.alertThreshold >= 100
              ? "bg-red-50 border border-red-200 text-red-800"
              : data.alertThreshold >= 90
                ? "bg-orange-50 border border-orange-200 text-orange-800"
                : "bg-yellow-50 border border-yellow-200 text-yellow-800"
          }`}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              {data.alertThreshold >= 100
                ? "Message quota reached"
                : `${data.alertThreshold}% of message quota used`}
            </p>
            <p className="text-sm mt-1">
              {data.alertThreshold >= 100 && !plan?.overagePermitted
                ? "Campaigns are paused. Purchase additional messages to continue sending."
                : "Consider upgrading your plan or purchasing additional messages."}
            </p>
          </div>
          <Button size="sm" className="ml-auto shrink-0">
            Buy More Messages
          </Button>
        </div>
      )}

      {/* Plan & Usage Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Plan</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {TIER_LABELS[plan?.tier] || "No Plan"}
            </p>
            <p className="text-sm text-muted-foreground">
              {plan?.monthlyAllotment?.toLocaleString() || 0} messages/month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Messages Used</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {usage.usage.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              of {usage.quota.toLocaleString()} ({usage.percentUsed}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Messages Remaining</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {Math.max(0, usage.quota - usage.usage).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              {plan?.overagePermitted ? "Overage allowed" : "Hard limit"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{usage.usage.toLocaleString()} used</span>
              <span>{usage.quota.toLocaleString()} total</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage.percentUsed >= 100
                    ? "bg-red-500"
                    : usage.percentUsed >= 90
                      ? "bg-orange-500"
                      : usage.percentUsed >= 75
                        ? "bg-yellow-500"
                        : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, usage.percentUsed)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Details */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
          <CardDescription>Your current messaging plan configuration.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Tier</dt>
              <dd className="font-medium">{TIER_LABELS[plan?.tier] || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Monthly Allotment</dt>
              <dd className="font-medium">
                {plan?.monthlyAllotment?.toLocaleString() || 0}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Overage Permitted</dt>
              <dd>
                <Badge variant={plan?.overagePermitted ? "success" : "secondary"}>
                  {plan?.overagePermitted ? "Yes" : "No"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Overage Rate</dt>
              <dd className="font-medium">
                {plan?.overageRate
                  ? `$${plan.overageRate.toFixed(4)}/segment`
                  : "-"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Add-On Purchases */}
      {data?.addOns?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.addOns.map((addon: any) => (
                <div
                  key={addon.id}
                  className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {addon.segmentCount.toLocaleString()} messages
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(addon.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="font-medium">
                    ${(addon.amount / 100).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
