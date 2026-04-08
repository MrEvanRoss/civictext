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
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-1" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-64 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Last 30 days overview.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
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

        <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.deliveryRate || 0}%</p>
            <p className="text-xs text-muted-foreground">
              {data?.deliveredMessages?.toLocaleString() || 0} delivered
            </p>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
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

        <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opt-Outs</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
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
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-base font-medium mb-1">No Campaign Data Yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Once you send your first campaign, performance metrics will appear here.
              </p>
            </div>
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
