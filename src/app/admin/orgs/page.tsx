"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listOrgsAction, createOrgAction } from "@/server/actions/admin";
import { Building2, Search, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    orgName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    initialCreditsDollars: 0,
  });

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listOrgsAction({
        search: search || undefined,
        status: status || undefined,
        page,
      });
      setOrgs(data.orgs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to load orgs:", err);
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleCreateOrg() {
    if (!createForm.orgName || !createForm.ownerName || !createForm.ownerEmail || !createForm.ownerPassword) {
      alert("Please fill in all fields");
      return;
    }
    if (createForm.ownerPassword.length < 12) {
      alert("Password must be at least 12 characters");
      return;
    }
    setCreating(true);
    try {
      await createOrgAction(createForm);
      setShowCreate(false);
      setCreateForm({
        orgName: "",
        ownerName: "",
        ownerEmail: "",
        ownerPassword: "",
        initialCreditsDollars: 0,
      });
      await loadOrgs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">
            Manage all organizations on the platform ({total} total)
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Organization
        </Button>
      </div>

      {/* Create Org Form */}
      {showCreate && (
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Organization</h2>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Organization Name</Label>
              <Input
                value={createForm.orgName}
                onChange={(e) => setCreateForm({ ...createForm, orgName: e.target.value })}
                placeholder="e.g., Smith for Senate"
              />
            </div>
            <div>
              <Label>Owner Name</Label>
              <Input
                value={createForm.ownerName}
                onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                placeholder="e.g., John Smith"
              />
            </div>
            <div>
              <Label>Owner Email</Label>
              <Input
                type="email"
                value={createForm.ownerEmail}
                onChange={(e) => setCreateForm({ ...createForm, ownerEmail: e.target.value })}
                placeholder="e.g., john@smithforsenate.com"
              />
            </div>
            <div>
              <Label>Owner Password (min 12 characters)</Label>
              <Input
                type="text"
                value={createForm.ownerPassword}
                onChange={(e) => setCreateForm({ ...createForm, ownerPassword: e.target.value })}
                placeholder="Temporary password for the owner"
              />
            </div>
            <div>
              <Label>Initial Credits ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={createForm.initialCreditsDollars}
                onChange={(e) => setCreateForm({ ...createForm, initialCreditsDollars: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum $5.00 if adding credits. Leave at $0 for no initial balance.
              </p>
            </div>
          </div>
          <Button onClick={handleCreateOrg} disabled={creating}>
            {creating ? "Creating..." : "Create Organization"}
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-40"
        >
          <option value="">All Status</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ARCHIVED">Archived</option>
          <option value="DEACTIVATED">Deactivated</option>
        </NativeSelect>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Organization</th>
              <th className="text-right p-3 font-medium">Balance</th>
              <th className="text-right p-3 font-medium">Users</th>
              <th className="text-right p-3 font-medium">Contacts</th>
              <th className="text-right p-3 font-medium">Campaigns</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No organizations found.
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono">
                    ${((org.messagingPlan?.balanceCents || 0) / 100).toFixed(2)}
                  </td>
                  <td className="p-3 text-right">{org._count.users}</td>
                  <td className="p-3 text-right">{org._count.contacts.toLocaleString()}</td>
                  <td className="p-3 text-right">{org._count.campaigns}</td>
                  <td className="p-3">
                    <Badge
                      variant={
                        org.status === "ACTIVE"
                          ? "success"
                          : org.status === "INACTIVE"
                          ? "destructive"
                          : org.status === "ARCHIVED"
                          ? "secondary"
                          : org.status === "PENDING_APPROVAL"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {org.status === "PENDING_APPROVAL" ? "PENDING" : org.status === "INACTIVE" ? "INACTIVE" : org.status === "ARCHIVED" ? "ARCHIVED" : org.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/orgs/${org.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
