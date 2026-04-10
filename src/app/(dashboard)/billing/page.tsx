"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBillingOverviewAction } from "@/server/actions/billing";
import {
  listBundlesAction,
  getActiveBundlesAction,
  getBundleSummaryAction,
  purchaseBundleAction,
  BUNDLE_TIERS,
  type BundleTier,
} from "@/server/actions/message-bundles";
import {
  AlertTriangle,
  Package,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { DEFAULT_SMS_RATE_CENTS, DEFAULT_MMS_RATE_CENTS } from "@/lib/constants";

// Standard rate in dollars — used as baseline to show bundle savings percentage.
// This is the list price, not org-specific — bundles save vs. this baseline.
const STANDARD_RATE_DOLLARS = DEFAULT_SMS_RATE_CENTS / 100;

interface MessagingPlan {
  id: string;
  orgId: string;
  balanceCents: number;
  smsRateCents: number;
  mmsRateCents: number;
  totalSpentCents: number;
  stripeCustomerId: string | null;
  phoneNumberFeeCents: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AddOnPurchase {
  id: string;
  messageCount: number;
  priceInCents: number;
  createdAt: Date;
}

interface BalanceInfo {
  balanceCents: number;
  balanceDollars: string;
}

interface BillingOverview {
  plan: MessagingPlan | null;
  balance: BalanceInfo;
  addOns: AddOnPurchase[];
  activePhoneNumbers: number;
  monthlyPhoneCostCents: number;
}

interface MessageBundle {
  id: string;
  bundleName: string;
  messageCount: number;
  remaining: number;
  totalPrice: number;
  purchasedAt: Date;
  expiresAt: Date | null;
}

interface BundleSummary {
  totalRemaining: number;
  totalSpent: number;
  totalMessagesPurchased: number;
  savings: number;
  activeBundleCount: number;
}

export default function BillingPage() {
  const router = useRouter();
  const canViewBilling = useBillingAccess();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Bundle state
  const [activeBundles, setActiveBundles] = useState<MessageBundle[]>([]);
  const [allBundles, setAllBundles] = useState<MessageBundle[]>([]);
  const [bundleSummary, setBundleSummary] = useState<BundleSummary | null>(null);
  const [purchasing, setPurchasing] = useState<BundleTier | null>(null);

  useEffect(() => {
    if (canViewBilling) {
      loadAll();
    } else {
      router.replace("/dashboard");
    }
  }, [canViewBilling, router]);

  async function loadAll() {
    try {
      const [billingResult, active, all, summary] = await Promise.all([
        getBillingOverviewAction(),
        getActiveBundlesAction(),
        listBundlesAction(),
        getBundleSummaryAction(),
      ]);
      setData(billingResult);
      setActiveBundles(active);
      setAllBundles(all);
      setBundleSummary(summary);
    } catch (err) {
      console.error("Failed to load billing:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(tier: BundleTier) {
    setPurchasing(tier);
    try {
      await purchaseBundleAction(tier);
      // Reload all bundle data
      const [active, all, summary] = await Promise.all([
        getActiveBundlesAction(),
        listBundlesAction(),
        getBundleSummaryAction(),
      ]);
      setActiveBundles(active);
      setAllBundles(all);
      setBundleSummary(summary);
    } catch (err) {
      console.error("Failed to purchase bundle:", err);
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-28 mb-1" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-1" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = data?.plan;
  const balanceLow = (plan?.balanceCents || 0) < 500; // Less than $5

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your prepaid messaging balance.
        </p>
      </div>

      {/* Low Balance Warning */}
      {balanceLow && (
        <div className="rounded-md p-4 flex items-center gap-3 bg-warning/10 border border-warning/30 text-warning">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              {(plan?.balanceCents || 0) === 0 ? "No balance remaining" : "Low balance"}
            </p>
            <p className="text-sm mt-1">
              Add funds to continue sending messages. Contact your account manager to purchase credits.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bundles">Message Bundles</TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* OVERVIEW TAB — existing billing content                          */}
        {/* ================================================================ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Balance & Rates */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-2">
                <CardDescription>Prepaid Balance</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  ${((plan?.balanceCents || 0) / 100).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  available for messaging
                </p>
              </CardContent>
            </Card>

            <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-2">
                <CardDescription>SMS Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {Number(plan?.smsRateCents ?? DEFAULT_SMS_RATE_CENTS) % 1 === 0 ? (plan?.smsRateCents ?? DEFAULT_SMS_RATE_CENTS) : Number(plan?.smsRateCents ?? DEFAULT_SMS_RATE_CENTS).toFixed(2)}&#162;
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  per SMS segment
                </p>
              </CardContent>
            </Card>

            <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-2">
                <CardDescription>MMS Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {Number(plan?.mmsRateCents ?? DEFAULT_MMS_RATE_CENTS) % 1 === 0 ? (plan?.mmsRateCents ?? DEFAULT_MMS_RATE_CENTS) : Number(plan?.mmsRateCents ?? DEFAULT_MMS_RATE_CENTS).toFixed(2)}&#162;
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  per MMS message
                </p>
              </CardContent>
            </Card>

            <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-2">
                <CardDescription>Phone Numbers</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {data?.activePhoneNumbers || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ${((data?.monthlyPhoneCostCents || 0) / 100).toFixed(2)}/month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Spending Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Summary</CardTitle>
              <CardDescription>Your messaging costs at a glance.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Total Spent</dt>
                  <dd className="font-medium font-mono text-lg">
                    ${((plan?.totalSpentCents || 0) / 100).toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Est. SMS Remaining</dt>
                  <dd className="font-medium text-lg">
                    {plan?.smsRateCents
                      ? Math.floor((plan.balanceCents || 0) / plan.smsRateCents).toLocaleString()
                      : "0"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Est. MMS Remaining</dt>
                  <dd className="font-medium text-lg">
                    {plan?.mmsRateCents
                      ? Math.floor((plan.balanceCents || 0) / plan.mmsRateCents).toLocaleString()
                      : "0"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Stripe Customer</dt>
                  <dd>
                    <Badge variant={plan?.stripeCustomerId ? "success" : "secondary"}>
                      {plan?.stripeCustomerId ? "Connected" : "Not Connected"}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Recent Purchases */}
          {(data?.addOns?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data!.addOns.map((addon: AddOnPurchase) => (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {addon.messageCount.toLocaleString()} credits
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(addon.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="font-medium font-mono">
                        ${(addon.priceInCents / 100).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* MESSAGE BUNDLES TAB                                              */}
        {/* ================================================================ */}
        <TabsContent value="bundles" className="space-y-6">
          {/* Bundle Summary Card */}
          {bundleSummary && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Package className="h-4 w-4" />
                    Pre-Purchased Remaining
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold font-mono">
                    {bundleSummary.totalRemaining.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    messages available
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    Total Bundle Spend
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold font-mono">
                    ${bundleSummary.totalSpent.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    across all bundles
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    Total Savings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold font-mono text-green-600">
                    ${bundleSummary.savings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    vs. standard rate
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Active Bundles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {bundleSummary.activeBundleCount}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    with messages remaining
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Active Bundles with Progress Bars */}
          {activeBundles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Bundles</CardTitle>
                <CardDescription>
                  Bundles with remaining messages, used in FIFO order.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeBundles.map((bundle: any) => {
                    const usedPct =
                      bundle.messageCount > 0
                        ? ((bundle.messageCount - bundle.remaining) /
                            bundle.messageCount) *
                          100
                        : 0;
                    const remainPct = 100 - usedPct;
                    return (
                      <div key={bundle.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {bundle.bundleName}
                            </span>
                            <span className="text-muted-foreground">
                              {bundle.remaining.toLocaleString()} /{" "}
                              {bundle.messageCount.toLocaleString()} remaining
                            </span>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {bundle.expiresAt
                              ? `Expires ${new Date(bundle.expiresAt).toLocaleDateString()}`
                              : "No expiry"}
                          </span>
                        </div>
                        <Progress value={remainPct} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Buy Message Bundle — Tier Cards */}
          <Card>
            <CardHeader>
              <CardTitle>Buy Message Bundle</CardTitle>
              <CardDescription>
                Pre-purchase messages at a discounted rate. Bundles expire 12
                months after purchase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {(
                  Object.entries(BUNDLE_TIERS) as [
                    BundleTier,
                    (typeof BUNDLE_TIERS)[BundleTier],
                  ][]
                ).map(([key, tier]) => {
                  const savingsPct = Math.round(
                    ((STANDARD_RATE_DOLLARS - tier.pricePerMessage) / STANDARD_RATE_DOLLARS) *
                      100
                  );
                  return (
                    <Card
                      key={key}
                      className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors"
                    >
                      {savingsPct >= 50 && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-bl-md">
                          Best Value
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{tier.name}</CardTitle>
                        <CardDescription>
                          {tier.messageCount.toLocaleString()} messages
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-2xl font-bold font-mono">
                            ${tier.totalPrice.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ${tier.pricePerMessage}/message
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-green-700 bg-green-100"
                        >
                          Save {savingsPct}% vs standard
                        </Badge>
                        <Button
                          className="w-full"
                          onClick={() => handlePurchase(key)}
                          disabled={purchasing !== null}
                        >
                          {purchasing === key ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Purchasing...
                            </>
                          ) : (
                            "Purchase"
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Purchase History Table */}
          {allBundles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Purchase History</CardTitle>
                <CardDescription>
                  All message bundle purchases for your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-muted-foreground">
                          Bundle
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground">
                          Messages
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground">
                          Remaining
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground">
                          Price
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground">
                          Purchased
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground">
                          Expires
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allBundles.map((bundle: any) => {
                        const expired =
                          bundle.expiresAt &&
                          new Date(bundle.expiresAt) < new Date();
                        const depleted = bundle.remaining === 0;
                        return (
                          <tr
                            key={bundle.id}
                            className="border-b last:border-0"
                          >
                            <td className="py-3 font-medium">
                              {bundle.bundleName}
                            </td>
                            <td className="py-3">
                              {bundle.messageCount.toLocaleString()}
                            </td>
                            <td className="py-3 font-mono">
                              {bundle.remaining.toLocaleString()}
                            </td>
                            <td className="py-3 font-mono">
                              ${bundle.totalPrice.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-3">
                              {new Date(
                                bundle.purchasedAt
                              ).toLocaleDateString()}
                            </td>
                            <td className="py-3">
                              {bundle.expiresAt
                                ? new Date(
                                    bundle.expiresAt
                                  ).toLocaleDateString()
                                : "--"}
                            </td>
                            <td className="py-3">
                              {expired ? (
                                <Badge variant="destructive">Expired</Badge>
                              ) : depleted ? (
                                <Badge variant="secondary">Used</Badge>
                              ) : (
                                <Badge variant="success">Active</Badge>
                              )}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
