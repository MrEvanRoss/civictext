"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listContactsAction,
  deleteContactAction,
} from "@/server/actions/contacts";
import { Users, Plus, Upload, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";

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
  }, [search]);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this contact? This cannot be undone.")) return;
    try {
      await deleteContactAction(id);
      loadContacts();
    } catch (err: any) {
      alert(err.message || "Failed to delete contact");
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            {data?.total ?? 0} total contacts
          </p>
        </div>
        <div className="flex gap-2">
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
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Contacts Yet</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Import contacts from a CSV file or add them manually to get started.
            </p>
            <div className="flex gap-2">
              <Link href="/contacts/import">
                <Button variant="outline">Import CSV</Button>
              </Link>
              <Button onClick={() => router.push("/contacts/new")}>
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
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="">All statuses</option>
              <option value="OPTED_IN">Opted In</option>
              <option value="OPTED_OUT">Opted Out</option>
              <option value="PENDING">Pending</option>
            </Select>
          </div>

          {/* Contact Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium">Name</th>
                        <th className="text-left py-3 px-4 font-medium">Phone</th>
                        <th className="text-left py-3 px-4 font-medium">Email</th>
                        <th className="text-left py-3 px-4 font-medium">Tags</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.contacts.map((contact) => (
                        <tr
                          key={contact.id}
                          className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                          onClick={() => router.push(`/contacts/${contact.id}`)}
                        >
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
                            <div className="flex gap-1 flex-wrap">
                              {contact.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {contact.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{contact.tags.length - 3}
                                </Badge>
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(contact.id);
                              }}
                            >
                              Delete
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
