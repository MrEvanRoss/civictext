"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getSupervisorDashboardAction } from "@/server/actions/supervisor";
import { autoAssignConversationsAction } from "@/server/actions/inbox";
import {
  AlertTriangle,
  Users,
  Inbox,
  MessageSquare,
  UserCheck,
  RefreshCw,
  Shuffle,
  UserX,
  Activity,
  Send,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AgentMetric {
  id: string;
  name: string;
  role: string;
  lastLoginAt: Date | null;
  openConversations: number;
  todayNotes: number;
  isOnline: boolean;
}

interface EscalatedConversation {
  id: string;
  escalatedReason: string | null;
  escalatedAt: Date | null;
  contact: {
    phone: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  assignedTo: {
    name: string;
  } | null;
}

interface P2PCampaignAgent {
  agentId: string;
  agentName: string;
  sent: number;
  pending: number;
  skipped: number;
  lastSentAt: Date | null;
}

interface P2PCampaign {
  id: string;
  name: string;
  status: string;
  sentCount: number;
  totalRecipients: number;
  startedAt: Date | null;
  agents: P2PCampaignAgent[];
}

interface SupervisorDashboardData {
  escalatedCount: number;
  openCount: number;
  unassignedCount: number;
  totalAgents: number;
  agentMetrics: AgentMetric[];
  escalatedConversations: EscalatedConversation[];
  todayMessages: number;
  weekMessages: number;
  todayOptOuts: number;
  p2pCampaigns: P2PCampaign[];
  flaggedAgentIds: string[];
}

export default function SupervisorPage() {
  const [data, setData] = useState<SupervisorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const result = await getSupervisorDashboardAction();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load supervisor dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoAssign() {
    try {
      const result = await autoAssignConversationsAction();
      toast.success(`Auto-assigned ${result.assigned} conversations.`);
      await loadDashboard();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to auto-assign");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-60" />
            <Skeleton className="h-4 w-80 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div>
                    <Skeleton className="h-7 w-10 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-24 mt-1" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supervisor Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor agents, review escalations, and manage workload.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoAssign}>
            <Shuffle className="h-4 w-4 mr-2" />
            Auto-Assign
          </Button>
          <Button variant="outline" onClick={loadDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-8 w-8 ${data.escalatedCount > 0 ? "text-orange-500" : "text-muted-foreground/30"}`} />
              <div>
                <p className={`text-2xl font-bold ${data.escalatedCount > 0 ? "text-warning" : ""}`}>
                  {data.escalatedCount}
                </p>
                <p className="text-xs text-muted-foreground">Escalated</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Inbox className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{data.openCount}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserX className={`h-8 w-8 ${data.unassignedCount > 0 ? "text-red-500" : "text-muted-foreground/30"}`} />
              <div>
                <p className={`text-2xl font-bold ${data.unassignedCount > 0 ? "text-destructive" : ""}`}>
                  {data.unassignedCount}
                </p>
                <p className="text-xs text-muted-foreground">Unassigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{data.todayMessages}</p>
                <p className="text-xs text-muted-foreground">Sent Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className={`h-8 w-8 ${data.todayOptOuts > 5 ? "text-red-500" : "text-muted-foreground/30"}`} />
              <div>
                <p className={`text-2xl font-bold ${data.todayOptOuts > 5 ? "text-destructive" : ""}`}>
                  {data.todayOptOuts}
                </p>
                <p className="text-xs text-muted-foreground">Opt-Outs Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Agent Workload */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Workload</CardTitle>
            <CardDescription>{data.totalAgents} agents</CardDescription>
          </CardHeader>
          <CardContent>
            {data.agentMetrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-base font-medium mb-1">No Agents Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Invite team members to start managing conversations and workload.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.agentMetrics.map((agent: any) => {
                  const isFlagged = data.flaggedAgentIds?.includes(agent.id);
                  return (
                    <div key={agent.id} className={`flex items-center justify-between p-3 rounded-lg ${isFlagged ? "bg-warning/10 border border-warning/30" : "bg-muted/50"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full ${agent.isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{agent.name}</p>
                            {isFlagged && (
                              <span title="This agent's send rate triggered an automated review flag. Check audit logs to verify human-initiated sending.">
                                <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  Rate flagged
                                </Badge>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {agent.role} &middot; {agent.todayNotes} notes today
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{agent.openConversations}</p>
                        <p className="text-xs text-muted-foreground">open</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Escalated Conversations */}
        <Card>
          <CardHeader>
            <CardTitle>
              Escalated Conversations
              {data.escalatedCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {data.escalatedCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Conversations flagged for review</CardDescription>
          </CardHeader>
          <CardContent>
            {data.escalatedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <UserCheck className="h-8 w-8 text-success/50" />
                </div>
                <h3 className="text-base font-medium mb-1">All Clear</h3>
                <p className="text-sm text-muted-foreground">No escalations requiring your attention.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {data.escalatedConversations.map((conv: any) => (
                  <div
                    key={conv.id}
                    className="p-3 rounded-lg border border-warning/30 bg-warning/5 cursor-pointer hover:bg-warning/10"
                    onClick={() => window.location.href = "/inbox"}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {conv.contact?.firstName
                          ? `${conv.contact.firstName} ${conv.contact.lastName || ""}`.trim()
                          : conv.contact?.phone}
                      </p>
                      {conv.assignedTo && (
                        <span className="text-xs text-muted-foreground">
                          {conv.assignedTo.name}
                        </span>
                      )}
                    </div>
                    {conv.escalatedReason && (
                      <p className="text-xs text-warning mt-1">{conv.escalatedReason}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {conv.escalatedAt
                        ? new Date(conv.escalatedAt).toLocaleString()
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* P2P Campaigns */}
      {data.p2pCampaigns?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Active P2P Campaigns
            </CardTitle>
            <CardDescription>Per-agent send progress and rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {data.p2pCampaigns.map((campaign: any) => {
              const pct = campaign.totalRecipients > 0
                ? (campaign.sentCount / campaign.totalRecipients) * 100
                : 0;
              return (
                <div key={campaign.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.sentCount} / {campaign.totalRecipients} sent
                      </p>
                    </div>
                    <Badge variant={campaign.status === "SENDING" ? "default" : "secondary"}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <Progress value={pct} className="h-2 mb-3" />

                  {/* Per-agent breakdown */}
                  <div className="space-y-2">
                    {campaign.agents.map((agent: any) => {
                      const total = agent.sent + agent.pending + agent.skipped;
                      const agentPct = total > 0 ? (agent.sent / total) * 100 : 0;
                      const isAgentFlagged = data.flaggedAgentIds?.includes(agent.agentId);
                      return (
                        <div key={agent.agentId} className={`flex items-center gap-3 text-sm p-2 rounded ${isAgentFlagged ? "bg-warning/10 border border-warning/30" : "bg-muted/50"}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{agent.agentName}</span>
                              {/* Abuse detection flag */}
                              {isAgentFlagged && (
                                <span title="This agent's send rate triggered an automated review flag. Check audit logs to verify human-initiated sending.">
                                  <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                    Rate flagged
                                  </Badge>
                                </span>
                              )}
                              {/* Flag agents who haven't sent recently */}
                              {!isAgentFlagged && agent.pending > 0 && agent.lastSentAt && (
                                (() => {
                                  const minsSinceLastSend = (Date.now() - new Date(agent.lastSentAt).getTime()) / 60000;
                                  return minsSinceLastSend > 15 ? (
                                    <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                                      idle {Math.round(minsSinceLastSend)}m
                                    </Badge>
                                  ) : null;
                                })()
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {agent.sent} sent &middot; {agent.pending} pending &middot; {agent.skipped} skipped
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground shrink-0">
                            {Math.round(agentPct)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
