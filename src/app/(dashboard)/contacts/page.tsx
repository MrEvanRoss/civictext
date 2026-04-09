"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  listContactsAction,
  deleteContactAction,
  bulkAddTagsAction,
  bulkDeleteContactsAction,
  exportContactsAction,
} from "@/server/actions/contacts";
import { toast } from "sonner";
import { Users, Plus, Upload, Search, Filter, ChevronLeft, ChevronRight, Download, Tag, Trash2, X } from "lucide-react";

interface Contact {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  tags: string[];
  optInStatus: string;
  createdAt: string;
  lastMessageAt: string | null;
}

interface ContactListResult {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ContactsPage() {
  const router = useRouter();
  const [data, setData] = useState<ContactListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listContactsAction({
        search: search || undefined,
        optInStatus: statusFilter as any || undefined,
        page,
        pageSize: 50,
      });
      setData(result as any);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      loadContacts();
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, loadContacts]);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this contact? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteContactAction(id);
      loadContacts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    if (selected.size === data.contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.contacts.map((c) => c.id)));
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} contacts? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await bulkDeleteContactsAction(Array.from(selected));
      setSelected(new Set());
      loadContacts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete contacts");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleBulkTag() {
    if (selected.size === 0 || !bulkTagInput.trim()) return;
    const tags = bulkTagInput.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      await bulkAddTagsAction(Array.from(selected), tags);
      setBulkTagInput("");
      setShowBulkTag(false);
      setSelected(new Set());
      loadContacts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add tags");
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportContactsAction({
        search: search || undefined,
        optInStatus: statusFilter as any || undefined,
      });
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export contacts");
    } finally {
      setExporting(false);
    }
  }

  function OptInBadge({ status }: { status: string }) {
    switch (status) {
      case "OPTED_IN":
        return <Badge variant="success">Opted In</Badge>;
      case "OPTED_OUT":
        return <Badge variant="destructive">Opted Out</Badge>;
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  const isEmpty = !loading && data?.total === 0 && !search && !statusFilter;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            {data?.total ?? 0} total contacts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
          <Link href="/contacts/segments">
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Segments
            </Button>
          </Link>
          <Link href="/contacts/import">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Button onClick={() => router.push("/contacts/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="flex items-center justify-center h-24 w-24 rounded-2xl bg-muted/50 mb-6">
              <Users className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No Contacts Yet</h2>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Get started by importing contacts from a CSV file or adding them manually. Once added, you can organize them with tags and segments.
            </p>
            <div className="flex gap-3">
              <Link href="/contacts/import">
                <Button variant="outline" size="lg">
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </Link>
              <Button size="lg" onClick={() => router.push("/contacts/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {!isEmpty && (
        <>
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                aria-label="Search contacts"
              />
            </div>
            <NativeSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-40"
              aria-label="Filter by opt-in status"
            >
              <option value="">All statuses</option>
              <option value="OPTED_IN">Opted In</option>
              <option value="OPTED_OUT">Opted Out</option>
              <option value="PENDING">Pending</option>
            </NativeSelect>
          </div>

          {/* Bulk Action Bar */}
          {selected.size > 0 && (
            <div className="sticky top-0 z-10 bg-background flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => setShowBulkTag(!showBulkTag)}>
                <Tag className="h-3.5 w-3.5 mr-1" /> Add Tags
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> {bulkDeleting ? "Deleting..." : "Delete"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
              {showBulkTag && (
                <div className="flex items-center gap-2 ml-2">
                  <Input
                    value={bulkTagInput}
                    onChange={(e) => setBulkTagInput(e.target.value)}
                    placeholder="tag1, tag2"
                    className="w-48 h-8"
                    aria-label="Tags to add to selected contacts"
                    onKeyDown={(e) => { if (e.key === "Enter") handleBulkTag(); }}
                  />
                  <Button size="sm" onClick={handleBulkTag} disabled={!bulkTagInput.trim()}>
                    Apply
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Contact Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 py-2">
                      <Skeleton className="h-4 w-4 rounded-sm" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-4 w-12 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th scope="col" className="py-3 px-4 w-10">
                          <Checkbox
                            checked={data ? selected.size === data.contacts.length && data.contacts.length > 0 : false}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all contacts"
                          />
                        </th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Name</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Phone</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Email</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Tags</th>
                        <th scope="col" className="text-left py-3 px-4 font-medium">Status</th>
                        <th scope="col" className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.contacts.map((contact) => (
                        <tr
                          key={contact.id}
                          className="border-b last:border-0 even:bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          tabIndex={0}
                          role="link"
                          onClick={() => router.push(`/contacts/${contact.id}`)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/contacts/${contact.id}`); } }}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(contact.id)}
                              onCheckedChange={() => toggleSelect(contact.id)}
                              aria-label={`Select ${contact.firstName || contact.lastName ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() : contact.phone}`}
                            />
                          </td>
                          <td className="py-3 px-4">
                            {contact.firstName || contact.lastName
                              ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
                              : "Unknown"}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {contact.phone}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {contact.email || "-"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1 flex-wrap items-center">
                              {contact.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                              {contact.tags.length > 2 && (
                                <span className="text-[10px] text-muted-foreground ml-0.5">
                                  +{contact.tags.length - 2} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <OptInBadge status={contact.optInStatus} />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={deletingId === contact.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(contact.id);
                              }}
                            >
                              {deletingId === contact.id ? "Deleting..." : "Delete"}
                            </Button>
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
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(data.page - 1) * data.pageSize + 1}-
                {Math.min(data.page * data.pageSize, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
