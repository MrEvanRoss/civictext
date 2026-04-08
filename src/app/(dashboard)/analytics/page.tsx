"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  getDashboardInsightsAction,
  getMessageTrendAction,
  getMemberGrowthAction,
  getCampaignComparisonAction,
  getBestSendingTimesAction,
  getTopCampaignsAction,
} from "@/server/actions/analytics";
import {
  Users,
  MessageSquare,
  TrendingUp,
  UserMinus,
  CheckCircle,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ============================================================
// Types
// ============================================================

interface DateRange {
  start: Date;
  end: Date;
}

interface KPIData {
  totalMembers: number;
  messagesSent: number;
  responseRate: number;
  optOutRate: number;
  deliveryRate: number;
}

interface MessageTrendEntry {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

interface MemberGrowthEntry {
  date: string;
  newMembers: number;
  optOuts: number;
  net: number;
}

interface CampaignComparisonEntry {
  id: string;
  name: string;
  sent: number;
  delivered: number;
  failed: number;
  responseCount: number;
}

interface HeatmapEntry {
  dayOfWeek: number;
  hour: number;
  responseRate: number;
  messageCount: number;
}

interface TopCampaignEntry {
  id: string;
  name: string;
  sent: number;
  delivered: number;
  responseRate: number;
  deliveryRate: number;
}

// ============================================================
// Helpers
// ============================================================

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getHourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

function getDateRange(preset: "7d" | "30d" | "90d"): DateRange {
  const end = new Date();
  const start = new Date();
  switch (preset) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
  }
  return { start, end };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getHeatmapColor(rate: number, maxRate: number): string {
  if (maxRate === 0 || rate === 0) return "bg-muted/30";
  const intensity = rate / maxRate;
  if (intensity > 0.8) return "bg-emerald-500";
  if (intensity > 0.6) return "bg-emerald-400";
  if (intensity > 0.4) return "bg-emerald-300";
  if (intensity > 0.2) return "bg-emerald-200";
  return "bg-emerald-100";
}

// ============================================================
// Skeleton Loader
// ============================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(true);

  // Data states
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [messageTrend, setMessageTrend] = useState<MessageTrendEntry[]>([]);
  const [memberGrowth, setMemberGrowth] = useState<MemberGrowthEntry[]>([]);
  const [campaignComparison, setCampaignComparison] = useState<
    CampaignComparisonEntry[]
  >([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapEntry[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaignEntry[]>([]);

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const [
        kpiResult,
        trendResult,
        growthResult,
        comparisonResult,
        heatmapResult,
        topResult,
      ] = await Promise.all([
        getDashboardInsightsAction(range),
        getMessageTrendAction(range, "day"),
        getMemberGrowthAction(range),
        getCampaignComparisonAction(range),
        getBestSendingTimesAction(),
        getTopCampaignsAction(range),
      ]);

      setKpi(kpiResult);
      setMessageTrend(trendResult);
      setMemberGrowth(growthResult);
      setCampaignComparison(comparisonResult);
      setHeatmapData(heatmapResult);
      setTopCampaigns(topResult);
    } catch (err) {
      console.error("Failed to load insights:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(getDateRange(preset));
  }, [preset, loadData]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const maxHeatmapRate = Math.max(
    ...heatmapData.map((d) => d.responseRate),
    0.01
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
          <p className="text-muted-foreground">
            Performance metrics and trends for your messaging.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              { key: "7d", label: "Last 7 Days" },
              { key: "30d", label: "Last 30 Days" },
              { key: "90d", label: "Last 90 Days" },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.key}
              variant={preset === opt.key ? "default" : "outline"}
              size="sm"
              onClick={() => setPreset(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Members
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {kpi?.totalMembers?.toLocaleString() ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Messages Sent
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {kpi?.messagesSent?.toLocaleString() ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Response Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpi?.responseRate ?? 0}%</p>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opt-Out Rate</CardTitle>
            <UserMinus className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {kpi?.optOutRate ?? 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Delivery Rate
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpi?.deliveryRate ?? 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Messages Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Messages Over Time</CardTitle>
            <CardDescription>
              Outbound message volume by delivery status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {messageTrend.length === 0 ? (
              <EmptyChartState label="No message data in this period." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={messageTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    fontSize={12}
                    className="fill-muted-foreground"
                  />
                  <YAxis fontSize={12} className="fill-muted-foreground" />
                  <Tooltip
                    labelFormatter={(label: any) => formatDate(String(label))}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    name="Sent"
                  />
                  <Line
                    type="monotone"
                    dataKey="delivered"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Delivered"
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Failed"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Member Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Member Growth</CardTitle>
            <CardDescription>
              New opt-ins vs opt-outs over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {memberGrowth.length === 0 ? (
              <EmptyChartState label="No member activity in this period." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={memberGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    fontSize={12}
                    className="fill-muted-foreground"
                  />
                  <YAxis fontSize={12} className="fill-muted-foreground" />
                  <Tooltip
                    labelFormatter={(label: any) => formatDate(String(label))}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="newMembers"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    name="New Members"
                  />
                  <Area
                    type="monotone"
                    dataKey="optOuts"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    name="Opt-Outs"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Campaign Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Comparison</CardTitle>
            <CardDescription>
              Top 10 campaigns by message volume.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campaignComparison.length === 0 ? (
              <EmptyChartState label="No campaigns in this period." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={campaignComparison} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" fontSize={12} className="fill-muted-foreground" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    fontSize={12}
                    className="fill-muted-foreground"
                    tickFormatter={(v: string) =>
                      v.length > 16 ? v.slice(0, 16) + "..." : v
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sent" fill="hsl(var(--primary))" name="Sent" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="delivered" fill="#10b981" name="Delivered" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Best Sending Times Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>Best Sending Times</CardTitle>
            <CardDescription>
              Response rates by day of week and hour. Darker = higher response
              rate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {heatmapData.length === 0 ? (
              <EmptyChartState label="No timing data available." />
            ) : (
              <div className="overflow-x-auto">
                {/* Hour labels */}
                <div className="grid" style={{ gridTemplateColumns: "48px repeat(24, 1fr)" }}>
                  <div />
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div
                      key={h}
                      className="text-[10px] text-muted-foreground text-center pb-1"
                    >
                      {h % 3 === 0 ? getHourLabel(h) : ""}
                    </div>
                  ))}
                </div>
                {/* Heatmap rows */}
                {DAY_LABELS.map((dayLabel, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="grid"
                    style={{ gridTemplateColumns: "48px repeat(24, 1fr)" }}
                  >
                    <div className="text-xs text-muted-foreground flex items-center pr-2 font-medium">
                      {dayLabel}
                    </div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const cell = heatmapData.find(
                        (d) => d.dayOfWeek === dayIdx && d.hour === h
                      );
                      const rate = cell?.responseRate ?? 0;
                      const count = cell?.messageCount ?? 0;
                      return (
                        <div
                          key={h}
                          className={`aspect-square m-[1px] rounded-sm ${getHeatmapColor(rate, maxHeatmapRate)} cursor-default`}
                          title={`${dayLabel} ${getHourLabel(h)}: ${rate}% response (${count} msgs)`}
                        />
                      );
                    })}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center justify-end gap-1 mt-3 text-[10px] text-muted-foreground">
                  <span>Low</span>
                  <div className="w-3 h-3 rounded-sm bg-emerald-100" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-200" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-300" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span>High</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Campaigns by Response Rate</CardTitle>
          <CardDescription>
            Highest-performing campaigns ranked by engagement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-base font-medium mb-1">
                No Campaign Data Yet
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Once you send campaigns, performance rankings will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">
                      Campaign
                    </th>
                    <th className="text-right py-3 px-2 font-medium">Sent</th>
                    <th className="text-right py-3 px-2 font-medium">
                      Delivered
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      Response Rate
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      Delivery Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-3 px-2 font-medium">{c.name}</td>
                      <td className="py-3 px-2 text-right">
                        {c.sent.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {c.delivered.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={
                            c.responseRate >= 10
                              ? "text-emerald-600 font-semibold"
                              : ""
                          }
                        >
                          {c.responseRate}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {c.deliveryRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Empty state for charts
// ============================================================

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
      <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
