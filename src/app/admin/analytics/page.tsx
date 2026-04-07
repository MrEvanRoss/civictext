"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getGlobalAnalyticsAction } from "@/server/actions/admin";
import {
  Building2,
  Users,
  Contact,
  MessageSquare,
  TrendingUp,
  BarChart3,
} from "lucide-react";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const result = await getGlobalAnalyticsAction();
      setData(result);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Failed to load analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Global Analytics</h1>
        <p className="text-muted-foreground">Platform-wide metrics (last 30 days)</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-medium">Organizations</span>
          </div>
          <p className="text-2xl font-bold">{data.totalOrgs}</p>
          <div className="flex gap-2 mt-1">
            <Badge variant="success" className="text-xs">{data.activeOrgs} active</Badge>
            {data.suspendedOrgs > 0 && (
              <Badge variant="destructive" className="text-xs">{data.suspendedOrgs} suspended</Badge>
            )}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Total Users</span>
          </div>
          <p className="text-2xl font-bold">{data.totalUsers.toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Contact className="h-4 w-4" />
            <span className="text-xs font-medium">Total Contacts</span>
          </div>
          <p className="text-2xl font-bold">{data.totalContacts.toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs font-medium">30-Day Campaigns</span>
          </div>
          <p className="text-2xl font-bold">{data.totalCampaigns}</p>
        </div>
      </div>

      {/* Messaging Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium">30-Day Messages</span>
          </div>
          <p className="text-2xl font-bold">{data.totalMessages.toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Delivery Rate</span>
          </div>
          <p className="text-2xl font-bold">{data.deliveryRate}%</p>
          <p className="text-xs text-muted-foreground">
            {data.deliveredMessages.toLocaleString()} delivered
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium">Failed Messages</span>
          </div>
          <p className="text-2xl font-bold text-destructive">
            {data.failedMessages.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Platform Summary */}
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Platform Summary</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Active Orgs</span>
              <Badge variant="success">{data.activeOrgs}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Suspended Orgs</span>
              <Badge variant="destructive">{data.suspendedOrgs}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Users</span>
              <Badge variant="secondary">{data.totalUsers}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Contacts</span>
              <Badge variant="secondary">{data.totalContacts?.toLocaleString()}</Badge>
            </div>
          )}
        </div>

        {/* Top Orgs by Volume */}
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Top Orgs by Volume (30 days)</h2>
          {data.topOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messaging activity.</p>
          ) : (
            <div className="space-y-2">
              {data.topOrgs.map((org: any, i: number) => (
                <div key={org.orgId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5">{i + 1}.</span>
                    <span>{org.name}</span>
                    {org.status === "SUSPENDED" && (
                      <Badge variant="destructive" className="text-xs">Suspended</Badge>
                    )}
                  </div>
                  <span className="font-mono">{org.messageCount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
