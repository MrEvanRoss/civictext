"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listMessagesAction,
  listOrgsAction,
  exportMessagesAction,
} from "@/server/actions/admin";
import {
  MessageSquare,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<any[]>([]);

  // Filters
  const [orgId, setOrgId] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    listOrgsAction({ page: 1 }).then((data) => {
      setOrgs(data.orgs);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadMessages();
  }, [page, orgId, direction, status, startDate, endDate]);

  async function loadMessages() {
    setLoading(true);
    try {
      const data = await listMessagesAction({
        orgId: orgId || undefined,
        direction: direction || undefined,
        status: status || undefined,
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
      });
      setMessages(data.messages);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setPage(1);
    loadMessages();
  }

  async function handleExport() {
    try {
      const { csv, filename } = await exportMessagesAction({
        orgId: orgId || undefined,
        direction: direction || undefined,
        status: status || undefined,
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to export messages");
    }
  }

  function statusBadge(s: string) {
    switch (s) {
      case "DELIVERED":
        return <Badge variant="success">{s}</Badge>;
      case "SENT":
        return <Badge variant="default">{s}</Badge>;
      case "QUEUED":
      case "SENDING":
        return <Badge variant="warning">{s}</Badge>;
      case "FAILED":
      case "UNDELIVERED":
        return <Badge variant="destructive">{s}</Badge>;
      default:
        return <Badge variant="outline">{s}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Message Log</h1>
          <p className="text-muted-foreground">
            {total.toLocaleString()} total messages across all organizations.
            Messages are retained permanently.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <NativeSelect
              value={orgId}
              onChange={(e) => { setOrgId(e.target.value); setPage(1); }}
            >
              <option value="">All Organizations</option>
              {orgs.map((org: any) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </NativeSelect>

            <NativeSelect
              value={direction}
              onChange={(e) => { setDirection(e.target.value); setPage(1); }}
            >
              <option value="">All Directions</option>
              <option value="OUTBOUND">Outbound</option>
              <option value="INBOUND">Inbound</option>
            </NativeSelect>

            <NativeSelect
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="SENDING">Sending</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="FAILED">Failed</option>
              <option value="UNDELIVERED">Undelivered</option>
            </NativeSelect>

            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              placeholder="Start date"
            />

            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              placeholder="End date"
            />

            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search body or phone..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
              <Button size="icon" variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No messages found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-3 font-medium">Date</th>
                    <th className="text-left py-3 px-3 font-medium">Organization</th>
                    <th className="text-left py-3 px-3 font-medium">Contact</th>
                    <th className="text-left py-3 px-3 font-medium">Direction</th>
                    <th className="text-left py-3 px-3 font-medium">Message</th>
                    <th className="text-left py-3 px-3 font-medium">Status</th>
                    <th className="text-left py-3 px-3 font-medium">Segments</th>
                    <th className="text-left py-3 px-3 font-medium">Campaign</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg: any) => (
                    <tr key={msg.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleDateString()}
                        <br />
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {msg.org?.name || msg.orgId.slice(0, 8)}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-mono text-xs">{msg.contact?.phone}</p>
                        {(msg.contact?.firstName || msg.contact?.lastName) && (
                          <p className="text-xs text-muted-foreground">
                            {[msg.contact?.firstName, msg.contact?.lastName].filter(Boolean).join(" ")}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={msg.direction === "INBOUND" ? "secondary" : "outline"} className="text-xs">
                          {msg.direction === "INBOUND" ? "IN" : "OUT"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 max-w-[300px]">
                        <p className="text-xs truncate">{msg.body}</p>
                      </td>
                      <td className="py-3 px-3">
                        {statusBadge(msg.status)}
                      </td>
                      <td className="py-3 px-3 text-center text-xs">
                        {msg.segmentCount}
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {msg.campaign?.name || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total.toLocaleString()} messages)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
