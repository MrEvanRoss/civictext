"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  listCampaignsAction,
  duplicateCampaignAction,
} from "@/server/actions/campaigns";
import {
  MessageSquare,
  Plus,
  Copy,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface CampaignSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  sentCount: number;
  deliveredCount: number;
  createdAt: Date | string;
  segment: { name: string; contactCount: number | null } | null;
  _count: { messages: number };
  [key: string]: unknown;
}

interface CampaignListResult {
  campaigns: CampaignSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const TYPE_LABELS: Record<string, string> = {
  BROADCAST: "Broadcast",
  P2P: "Peer-to-Peer",
  DRIP: "Drip Sequence",
  AUTO_REPLY: "Auto-Reply",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  SCHEDULED: "warning",
  SENDING: "default",
  PAUSED: "outline",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  COMPLETED: "bg-success",
  SENDING: "bg-primary animate-pulse",
  SCHEDULED: "bg-warning",
  DRAFT: "bg-muted-foreground/40",
  FAILED: "bg-destructive",
  CANCELLED: "bg-destructive",
  PAUSED: "bg-muted-foreground/40",
};

export default function CampaignsPage() {
  const router = useRouter();
  const [data, setData] = useState<CampaignListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCampaignsAction({
        status: statusFilter as any || undefined,
        type: typeFilter as any || undefined,
        page,
      });
      setData(result);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, page]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  async function handleDuplicate(campaignId: string) {
    try {
      const dup = await duplicateCampaignAction(campaignId);
      toast.success("Campaign duplicated successfully");
      router.push(`/campaigns/${dup.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate campaign");
    }
  }

  const isEmpty = !loading && data?.total === 0 && !statusFilter && !typeFilter;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            {data?.total ?? 0} total campaigns
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {isEmpty && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="flex items-center justify-center h-24 w-24 rounded-2xl bg-muted/50 mb-6">
              <MessageSquare className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No Campaigns Yet</h2>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Create your first campaign to start reaching contacts. Choose from
              Broadcast, P2P, Drip Sequence, or Auto-Reply.
            </p>
            <Link href="/campaigns/new">
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Create Your First Campaign
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!isEmpty && (
        <>
          <div className="flex gap-4">
            <NativeSelect
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-40"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="SENDING">Sending</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </NativeSelect>
            <NativeSelect
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="w-40"
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              <option value="BROADCAST">Broadcast</option>
              <option value="P2P">Peer-to-Peer</option>
              <option value="DRIP">Drip Sequence</option>
              <option value="AUTO_REPLY">Auto-Reply</option>
            </NativeSelect>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th scope="col" className="text-left py-3 px-4 font-medium">Name</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Type</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Status</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Audience</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Sent</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Delivered</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Created</th>
                        <th scope="col" className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-4 w-28" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-4 w-10" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-4 w-10" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                          <td className="py-3 px-4 text-right"><Skeleton className="h-8 w-24 ml-auto" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th scope="col" className="text-left py-3 px-4 font-medium">Name</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Type</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Status</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Audience</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Sent</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Delivered</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Created</th>
                        <th scope="col" className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.campaigns.map((campaign: CampaignSummary) => (
                        <tr
                          key={campaign.id}
                          className="border-b last:border-0 even:bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          tabIndex={0}
                          role="link"
                          onClick={() => router.push(`/campaigns/${campaign.id}`)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/campaigns/${campaign.id}`); } }}
                        >
                          <td className="py-3 px-4 font-medium">
                            {campaign.name}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline">
                              {TYPE_LABELS[campaign.type] || campaign.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={STATUS_VARIANTS[campaign.status] || "outline"}>
                              <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full mr-1.5 ${STATUS_DOT_COLORS[campaign.status] || "bg-muted-foreground/40"}`} />
                              {campaign.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {campaign.segment?.name || "No segment"}
                            {campaign.segment?.contactCount != null && (
                              <span className="ml-1">
                                ({campaign.segment.contactCount})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">{campaign.sentCount || 0}</td>
                          <td className="py-3 px-4">
                            {campaign.deliveredCount || 0}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(campaign.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {campaign.status === "DRAFT" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/campaigns/${campaign.id}/edit`);
                                  }}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicate(campaign.id);
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Duplicate
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
