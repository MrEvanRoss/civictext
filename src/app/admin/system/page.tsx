"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSystemHealthAction } from "@/server/actions/admin";
import { Activity, Database, HardDrive, RefreshCw, Server } from "lucide-react";

export default function AdminSystemPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
  }, []);

  async function loadHealth() {
    setLoading(true);
    try {
      const result = await getSystemHealthAction();
      setData(result);
    } catch (err) {
      console.error("Failed to load system health:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading system health...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Failed to load system health.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-muted-foreground">
            Infrastructure status and queue monitoring
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadHealth}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-3 gap-4">
        {/* Database */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <h2 className="font-semibold">Database</h2>
            </div>
            <Badge
              variant={data.database.status === "connected" ? "success" : "destructive"}
            >
              {data.database.status}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Organizations</span>
              <span className="font-medium">{data.database.orgCount}</span>
            </div>
          </div>
        </div>

        {/* Redis */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              <h2 className="font-semibold">Redis</h2>
            </div>
            <Badge
              variant={data.redis.status === "connected" ? "success" : "destructive"}
            >
              {data.redis.status}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Memory</span>
              <span className="font-medium">{data.redis.memory}</span>
            </div>
          </div>
        </div>

        {/* Queues */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <h2 className="font-semibold">Message Queues</h2>
            </div>
            <Badge
              variant={
                data.queues.failedJobs > 0
                  ? "warning"
                  : "success"
              }
            >
              {data.queues.failedJobs > 0 ? "Has Failures" : "Healthy"}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Queue Depth</span>
              <span className="font-medium">{data.queues.depth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Failed Jobs</span>
              <span className={`font-medium ${data.queues.failedJobs > 0 ? "text-destructive" : ""}`}>
                {data.queues.failedJobs}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Runtime Info */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Server className="h-5 w-5" />
          <h2 className="font-semibold">Runtime</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Environment</span>
            <Badge variant="secondary">{data.environment}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Node.js</span>
            <span className="font-mono">{data.nodeVersion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-medium">{formatUptime(data.uptime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
