"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getComplianceOverviewAction } from "@/server/actions/admin";
import { Shield, AlertTriangle, Radio, CheckCircle } from "lucide-react";

export default function AdminCompliancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompliance();
  }, []);

  async function loadCompliance() {
    try {
      const result = await getComplianceOverviewAction();
      setData(result);
    } catch (err) {
      console.error("Failed to load compliance:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading compliance data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Failed to load compliance data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance Monitoring</h1>
        <p className="text-muted-foreground">
          Track opt-out rates, delivery failures, and 10DLC registration status
        </p>
      </div>

      {/* 10DLC Status */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="h-5 w-5" />
          <h2 className="font-semibold">10DLC Registration Status</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{data.dlcStatus.pendingBrands}</p>
            <p className="text-xs text-muted-foreground">Pending Brands</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{data.dlcStatus.approvedBrands}</p>
            <p className="text-xs text-muted-foreground">Approved Brands</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{data.dlcStatus.rejectedBrands}</p>
            <p className="text-xs text-muted-foreground">Rejected Brands</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{data.dlcStatus.pendingCampaigns}</p>
            <p className="text-xs text-muted-foreground">Pending Campaigns</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{data.dlcStatus.approvedCampaigns}</p>
            <p className="text-xs text-muted-foreground">Approved Campaigns</p>
          </div>
        </div>
      </div>

      {/* High Opt-Out Campaigns */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold">High Opt-Out Campaigns (&gt;5%)</h2>
          {data.highOptOutCampaigns.length === 0 && (
            <Badge variant="success" className="ml-2">
              <CheckCircle className="h-3 w-3 mr-1" />
              All Clear
            </Badge>
          )}
        </div>
        {data.highOptOutCampaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Campaign</th>
                  <th className="text-left p-2 font-medium">Organization</th>
                  <th className="text-right p-2 font-medium">Sent</th>
                  <th className="text-right p-2 font-medium">Opt-Outs</th>
                  <th className="text-right p-2 font-medium">Opt-Out Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.highOptOutCampaigns.map((c: any) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{c.name}</td>
                    <td className="p-2 text-muted-foreground">{c.orgName}</td>
                    <td className="p-2 text-right">{c.sentCount.toLocaleString()}</td>
                    <td className="p-2 text-right">{c.optOutCount}</td>
                    <td className="p-2 text-right">
                      <Badge variant="destructive">{c.optOutRate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No campaigns with opt-out rates above 5% in the last 30 days.
          </p>
        )}
      </div>

      {/* High Failure Rate Campaigns */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-red-500" />
          <h2 className="font-semibold">High Failure Rate Campaigns (&gt;10%)</h2>
          {data.highFailureOrgs.length === 0 && (
            <Badge variant="success" className="ml-2">
              <CheckCircle className="h-3 w-3 mr-1" />
              All Clear
            </Badge>
          )}
        </div>
        {data.highFailureOrgs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Campaign</th>
                  <th className="text-left p-2 font-medium">Organization</th>
                  <th className="text-right p-2 font-medium">Sent</th>
                  <th className="text-right p-2 font-medium">Failed</th>
                  <th className="text-right p-2 font-medium">Failure Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.highFailureOrgs.map((c: any) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{c.name}</td>
                    <td className="p-2 text-muted-foreground">{c.orgName}</td>
                    <td className="p-2 text-right">{c.sentCount.toLocaleString()}</td>
                    <td className="p-2 text-right">{c.failedCount}</td>
                    <td className="p-2 text-right">
                      <Badge variant="destructive">{c.failureRate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No campaigns with failure rates above 10% in the last 30 days.
          </p>
        )}
      </div>
    </div>
  );
}
