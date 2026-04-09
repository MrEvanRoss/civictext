"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getCampaignAction,
  changeCampaignStatusAction,
  duplicateCampaignAction,
  exportCampaignAction,
  getCampaignLinkStatsAction,
} from "@/server/actions/campaigns";
import {
  ArrowLeft,
  Play,
  Pause,
  XCircle,
  Copy,
  Send,
  Download,
  Pencil,
  Clock,
  MousePointerClick,
  ExternalLink,
  Link2,
} from "lucide-react";

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  SCHEDULED: "warning",
  SENDING: "default",
  PAUSED: "outline",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

const TYPE_LABELS: Record<string, string> = {
  BROADCAST: "Broadcast",
  P2P: "Peer-to-Peer",
  DRIP: "Drip Sequence",
  AUTO_REPLY: "Auto-Reply",
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkStats, setLinkStats] = useState<{
    links: { id: string; originalUrl: string; shortCode: string; clickCount: number; createdAt: string }[];
    totalClicks: number;
    totalLinks: number;
    uniqueUrls: number;
  } | null>(null);

  // M-19: Mounted flag to cancel state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadCampaign = useCallback(async () => {
    try {
      const data = await getCampaignAction(campaignId);
      if (!mountedRef.current) return;
      if (!data) {
        router.push("/campaigns");
        return;
      }
      setCampaign(data);
    } catch (err: unknown) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Failed to load campaign");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [campaignId, router]);

  const loadLinkStats = useCallback(async () => {
    try {
      const stats = await getCampaignLinkStatsAction(campaignId);
      setLinkStats(stats);
    } catch {
      // Non-critical — silently fail
    }
  }, [campaignId]);

  useEffect(() => {
    loadCampaign();
    loadLinkStats();
  }, [loadCampaign, loadLinkStats]);

  // Auto-refresh every 10 seconds while actively sending
  const campaignStatus = campaign?.status;
  useEffect(() => {
    const isActive = campaignStatus === "SENDING" || campaignStatus === "EXPANDING";
    if (!isActive) return;

    const interval = setInterval(() => {
      loadCampaign();
    }, 10_000);

    return () => clearInterval(interval);
  }, [campaignStatus, loadCampaign]);

  function getCompletionEstimate() {
    if (!campaign) return null;
    const isActive = campaign.status === "SENDING" || campaign.status === "EXPANDING";
    if (!isActive) return null;

    const sent = campaign.sentCount || 0;
    const total = campaign.totalRecipients || 0;
    const remaining = total - sent;

    if (total === 0 || remaining <= 0) return null;
    if (sent < 10) return { label: "Calculating...", detail: `${sent} of ${total} sent` };

    const startedAt = campaign.startedAt ? new Date(campaign.startedAt).getTime() : null;
    if (!startedAt) return { label: "Calculating...", detail: `${sent} of ${total} sent` };

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs <= 0) return { label: "Calculating...", detail: `${sent} of ${total} sent` };

    const msPerMessage = elapsedMs / sent;
    const remainingMs = remaining * msPerMessage;
    const remainingMinutes = Math.ceil(remainingMs / 60_000);

    let label: string;
    if (remainingMinutes < 1) {
      label = "~less than a minute remaining";
    } else if (remainingMinutes < 60) {
      label = `~${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"} remaining`;
    } else {
      const hours = Math.floor(remainingMinutes / 60);
      const mins = remainingMinutes % 60;
      label = mins > 0
        ? `~${hours} hour${hours === 1 ? "" : "s"} ${mins} min remaining`
        : `~${hours} hour${hours === 1 ? "" : "s"} remaining`;
    }

    const rate = (1000 / msPerMessage).toFixed(1);
    const detail = `${sent.toLocaleString()} of ${total.toLocaleString()} sent (${rate} msg/sec)`;

    return { label, detail };
  }

  async function handleStatusChange(newStatus: string) {
    const confirmMessages: Record<string, string> = {
      SENDING: "Start sending this campaign?",
      PAUSED: "Pause this campaign? Unsent messages will remain in the queue.",
      CANCELLED: "Cancel this campaign? Unsent messages will be discarded. This cannot be undone.",
    };

    if (confirmMessages[newStatus] && !confirm(confirmMessages[newStatus])) return;

    try {
      await changeCampaignStatusAction(campaignId, newStatus);
      await loadCampaign();
    } catch (err: any) {
      setError(err.message || "Failed to change status");
    }
  }

  async function handleDuplicate() {
    try {
      const dup = await duplicateCampaignAction(campaignId);
      router.push(`/campaigns/${dup.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to duplicate");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
            {error}
          </div>
          <Button onClick={() => { setError(""); setLoading(true); loadCampaign(); }}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const deliveryRate =
    campaign.sentCount > 0
      ? ((campaign.deliveredCount / campaign.sentCount) * 100).toFixed(1)
      : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/campaigns")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {campaign.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={STATUS_VARIANTS[campaign.status] || "outline"}>
                {campaign.status}
              </Badge>
              <Badge variant="outline">
                {TYPE_LABELS[campaign.type] || campaign.type}
              </Badge>
              {campaign.createdBy && (
                <span className="text-sm text-muted-foreground">
                  by {campaign.createdBy.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {campaign.status === "DRAFT" && (
            <>
              <Button variant="outline" onClick={() => router.push(`/campaigns/${campaignId}/edit`)}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button onClick={() => handleStatusChange("SENDING")}>
                <Send className="h-4 w-4 mr-1" />
                Send Now
              </Button>
            </>
          )}
          {campaign.status === "SENDING" && (
            <Button variant="outline" onClick={() => handleStatusChange("PAUSED")}>
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
          )}
          {campaign.status === "PAUSED" && (
            <Button onClick={() => handleStatusChange("SENDING")}>
              <Play className="h-4 w-4 mr-1" />
              Resume
            </Button>
          )}
          {["DRAFT", "SCHEDULED", "SENDING", "PAUSED"].includes(campaign.status) && (
            <Button
              variant="destructive"
              onClick={() => handleStatusChange("CANCELLED")}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
          <Button variant="outline" onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-1" />
            Duplicate
          </Button>
          {campaign.sentCount > 0 && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const { csv, filename } = await exportCampaignAction(campaignId);
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err: any) {
                  setError(err.message || "Failed to export");
                }
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Sent", value: campaign.sentCount || 0, color: "text-foreground" },
          { label: "Delivered", value: campaign.deliveredCount || 0, color: "text-success" },
          { label: "Failed", value: campaign.failedCount || 0, color: "text-destructive" },
          { label: "Responses", value: campaign.responseCount || 0, color: "text-info" },
          { label: "Link Clicks", value: linkStats?.totalClicks ?? 0, color: "text-purple-500" },
          { label: "Delivery Rate", value: `${deliveryRate}%`, color: "text-foreground" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Completion Estimate */}
      {(() => {
        const estimate = getCompletionEstimate();
        if (!estimate) return null;
        return (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="text-sm">
              <span className="font-medium">{estimate.label}</span>
              <span className="text-muted-foreground ml-2">{estimate.detail}</span>
            </div>
          </div>
        );
      })()}

      {/* Campaign Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
              {campaign.messageBody}
            </div>
            {campaign.mediaUrl && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">MMS Media:</p>
                <p className="text-xs font-mono">{campaign.mediaUrl}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Segment</dt>
                <dd>{campaign.segment?.name || "None"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{new Date(campaign.createdAt).toLocaleString()}</dd>
              </div>
              {campaign.scheduledAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Scheduled</dt>
                  <dd>{new Date(campaign.scheduledAt).toLocaleString()}</dd>
                </div>
              )}
              {campaign.startedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Started</dt>
                  <dd>{new Date(campaign.startedAt).toLocaleString()}</dd>
                </div>
              )}
              {campaign.completedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd>{new Date(campaign.completedAt).toLocaleString()}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Opt-Outs</dt>
                <dd>{campaign.optOutCount || 0}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Link Performance */}
        {linkStats && linkStats.totalLinks > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MousePointerClick className="h-5 w-5" />
                  Link Performance
                </CardTitle>
                {(campaign.sentCount || 0) > 0 && (
                  <Badge variant="outline" className="text-sm font-medium">
                    {((linkStats.totalClicks / (campaign.sentCount || 1)) * 100).toFixed(1)}% CTR
                  </Badge>
                )}
              </div>
              <CardDescription>
                {linkStats.totalClicks} total click{linkStats.totalClicks !== 1 ? "s" : ""} across {linkStats.uniqueUrls} link{linkStats.uniqueUrls !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Group links by original URL and sum clicks */}
                {(() => {
                  const urlMap = new Map<string, { clicks: number; shortCodes: string[] }>();
                  linkStats.links.forEach((l) => {
                    const existing = urlMap.get(l.originalUrl);
                    if (existing) {
                      existing.clicks += l.clickCount;
                      existing.shortCodes.push(l.shortCode);
                    } else {
                      urlMap.set(l.originalUrl, { clicks: l.clickCount, shortCodes: [l.shortCode] });
                    }
                  });

                  const sortedUrls = Array.from(urlMap.entries()).sort((a, b) => b[1].clicks - a[1].clicks);
                  const maxClicks = sortedUrls[0]?.[1].clicks || 1;

                  return sortedUrls.map(([url, data]) => (
                    <div key={url} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline truncate"
                            title={url}
                          >
                            {url.replace(/^https?:\/\/(www\.)?/, "")}
                          </a>
                          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        </div>
                        <span className="text-sm font-semibold tabular-nums shrink-0">
                          {data.clicks} click{data.clicks !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {/* Click bar */}
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all"
                          style={{ width: `${Math.max((data.clicks / maxClicks) * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Drip Steps */}
        {campaign.dripSteps?.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Drip Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {campaign.dripSteps.map((step: any, i: number) => (
                  <div key={step.id} className="flex items-start gap-4 p-3 bg-muted rounded-lg">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{step.messageBody}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Delay: {step.delayMinutes} minutes
                        {step.triggerKeyword && ` | Trigger: "${step.triggerKeyword}"`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auto-Reply Rules */}
        {campaign.autoReplyRules?.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Auto-Reply Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {campaign.autoReplyRules.map((rule: any) => (
                  <div key={rule.id} className="flex items-start gap-4 p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {rule.keywords.map((kw: string) => (
                          <Badge key={kw} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Reply: {rule.replyBody}
                      </p>
                    </div>
                    <Badge variant={rule.isActive ? "success" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
