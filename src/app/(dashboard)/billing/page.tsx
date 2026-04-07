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
import { CreditCard, AlertTriangle } from "lucide-react";

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
  const balance = data?.balance || { balanceCents: 0, balanceDollars: "0.00" };
  const balanceLow = (plan?.balanceCents || 0) < 500; // Less than $5

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your prepaid messaging balance.
        </p>
      </div>

      {/* Low Balance Warning */}
      {balanceLow && (
        <div className="rounded-md p-4 flex items-center gap-3 bg-orange-50 border border-orange-200 text-orange-800">
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

      {/* Balance & Rates */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>SMS Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {plan?.smsRateCents || 4}&#162;
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              per SMS segment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>MMS Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {plan?.mmsRateCents || 8}&#162;
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              per MMS message
            </p>
          </CardContent>
        </Card>

        <Card>
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
    </div>
  );
}
