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
} from "lucide-react";

export default function SupervisorPage() {
  const [data, setData] = useState<any>(null);
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
    } catch (err: any) {
      setError(err.message || "Failed to load supervisor dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoAssign() {
    try {
      const result = await autoAssignConversationsAction();
      alert(`Auto-assigned ${result.assigned} conversations.`);
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || "Failed to auto-assign");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
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
    <div className="space-y-6">
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
                <p className={`text-2xl font-bold ${data.escalatedCount > 0 ? "text-orange-600" : ""}`}>
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
                <p className={`text-2xl font-bold ${data.unassignedCount > 0 ? "text-red-600" : ""}`}>
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
                <p className={`text-2xl font-bold ${data.todayOptOuts > 5 ? "text-red-600" : ""}`}>
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
              <p className="text-sm text-muted-foreground text-center py-4">No agents found.</p>
            ) : (
              <div className="space-y-3">
                {data.agentMetrics.map((agent: any) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${agent.isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                      <div>
                        <p className="text-sm font-medium">{agent.name}</p>
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
                ))}
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
              <div className="flex flex-col items-center py-8">
                <UserCheck className="h-8 w-8 text-green-500/50 mb-2" />
                <p className="text-sm text-muted-foreground">No escalations. All clear.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {data.escalatedConversations.map((conv: any) => (
                  <div
                    key={conv.id}
                    className="p-3 rounded-lg border border-orange-200 bg-orange-50/50 cursor-pointer hover:bg-orange-50"
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
                      <p className="text-xs text-orange-700 mt-1">{conv.escalatedReason}</p>
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
    </div>
  );
}
