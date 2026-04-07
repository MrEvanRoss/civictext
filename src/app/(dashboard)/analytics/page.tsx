"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardAnalyticsAction } from "@/server/actions/analytics";
import {
  Send,
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const result = await getDashboardAnalyticsAction();
      setData(result);
    } catch (err) {
      console.error("Failed to load analytics:", err);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Last 30 days overview.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data?.totalMessages?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.deliveryRate || 0}%</p>
            <p className="text-xs text-muted-foreground">
              {data?.deliveredMessages?.toLocaleString() || 0} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data?.totalContacts?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-muted-foreground">Opted-in contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opt-Outs</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {data?.optedOutContacts || 0}
            </p>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Top Campaigns</CardTitle>
          <CardDescription>
            Best performing campaigns in the last 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.topCampaigns?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No campaigns completed yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Campaign</th>
                    <th className="text-right py-3 px-2 font-medium">Sent</th>
                    <th className="text-right py-3 px-2 font-medium">Delivered</th>
                    <th className="text-right py-3 px-2 font-medium">Delivery %</th>
                    <th className="text-right py-3 px-2 font-medium">Responses</th>
                    <th className="text-right py-3 px-2 font-medium">Opt-Outs</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.topCampaigns?.map((c: any) => {
                    const rate =
                      c.sentCount > 0
                        ? ((c.deliveredCount / c.sentCount) * 100).toFixed(1)
                        : "0";
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-3 px-2 font-medium">{c.name}</td>
                        <td className="py-3 px-2 text-right">{c.sentCount}</td>
                        <td className="py-3 px-2 text-right">{c.deliveredCount}</td>
                        <td className="py-3 px-2 text-right">{rate}%</td>
                        <td className="py-3 px-2 text-right">{c.responseCount}</td>
                        <td className="py-3 px-2 text-right">{c.optOutCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
