"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getSubcommunityAction,
  getSubcommunityMembersAction,
  updateSubcommunityAction,
  deleteSubcommunityAction,
  removeMemberAction,
  addMembersAction,
  searchContactsForSubcommunityAction,
} from "@/server/actions/subcommunities";
import {
  ArrowLeft,
  Users,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Color helper (same as list page)
// ---------------------------------------------------------------------------
const SUBCOMMUNITY_COLORS = [
  "bg-pink-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-blue-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function getSubcommunityColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SUBCOMMUNITY_COLORS[Math.abs(hash) % SUBCOMMUNITY_COLORS.length];
}

export default function SubcommunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const subcommunityId = params.id as string;

  // Subcommunity data
  const [subcommunity, setSubcommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Members
  const [members, setMembers] = useState<any[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage, setMembersPage] = useState(1);
  const [membersTotalPages, setMembersTotalPages] = useState(1);
  const [membersLoading, setMembersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit form
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editKeyword, setEditKeyword] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add members modal
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);

  // Load subcommunity data
  const loadSubcommunity = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubcommunityAction(subcommunityId);
      setSubcommunity(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load subcommunity");
      router.push("/subcommunities");
    } finally {
      setLoading(false);
    }
  }, [subcommunityId, router]);

  // Load members
  const loadMembers = useCallback(
    async (page = 1, search = "") => {
      setMembersLoading(true);
      try {
        const result = await getSubcommunityMembersAction(subcommunityId, {
          page,
          pageSize: 25,
          search: search || undefined,
          sortBy: "joinedAt",
          sortOrder: "desc",
        });
        setMembers(result.members);
        setMembersTotal(result.total);
        setMembersPage(result.page);
        setMembersTotalPages(result.totalPages);
      } catch (err: any) {
        toast.error(err.message || "Failed to load members");
      } finally {
        setMembersLoading(false);
      }
    },
    [subcommunityId]
  );

  useEffect(() => {
    loadSubcommunity();
    loadMembers(1, "");
  }, [loadSubcommunity, loadMembers]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setMembersPage(1);
      loadMembers(1, searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, loadMembers]);

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------
  function openEdit() {
    if (!subcommunity) return;
    setEditName(subcommunity.name);
    setEditDescription(subcommunity.description || "");
    setEditKeyword(subcommunity.joinKeyword || "");
    setEditIsPublic(subcommunity.isPublic);
    setShowEdit(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await updateSubcommunityAction(subcommunityId, {
        name: editName,
        description: editDescription,
        joinKeyword: editKeyword,
        isPublic: editIsPublic,
      });
      setShowEdit(false);
      toast.success("Subcommunity updated");
      await loadSubcommunity();
    } catch (err: any) {
      toast.error(err.message || "Failed to update subcommunity");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------
  async function handleDelete() {
    if (
      !confirm(
        "Delete this subcommunity? All members will be removed but contacts will remain."
      )
    )
      return;
    try {
      await deleteSubcommunityAction(subcommunityId);
      toast.success("Subcommunity deleted");
      router.push("/subcommunities");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete subcommunity");
    }
  }

  // ---------------------------------------------------------------------------
  // Remove member handler
  // ---------------------------------------------------------------------------
  async function handleRemoveMember(contactId: string) {
    if (!confirm("Remove this member from the subcommunity?")) return;
    try {
      await removeMemberAction(subcommunityId, contactId);
      toast.success("Member removed");
      await loadMembers(membersPage, searchQuery);
      await loadSubcommunity();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  }

  // ---------------------------------------------------------------------------
  // Add members handlers
  // ---------------------------------------------------------------------------
  async function handleSearchContacts(query: string) {
    setContactSearch(query);
    if (!query.trim()) {
      setContactResults([]);
      return;
    }
    setSearchingContacts(true);
    try {
      const results = await searchContactsForSubcommunityAction(
        subcommunityId,
        query
      );
      setContactResults(results);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setSearchingContacts(false);
    }
  }

  function toggleContactSelection(contactId: string) {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }

  async function handleAddSelectedMembers() {
    if (selectedContacts.size === 0) return;
    setAddingMembers(true);
    try {
      const result = await addMembersAction(
        subcommunityId,
        Array.from(selectedContacts)
      );
      toast.success(
        `Added ${result.added} member${result.added !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} already in group)` : ""}`
      );
      setShowAddMembers(false);
      setSelectedContacts(new Set());
      setContactSearch("");
      setContactResults([]);
      await loadMembers(membersPage, searchQuery);
      await loadSubcommunity();
    } catch (err: any) {
      toast.error(err.message || "Failed to add members");
    } finally {
      setAddingMembers(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subcommunity) return null;

  const color = getSubcommunityColor(subcommunity.name);
  const memberCount =
    subcommunity._count?.members ?? subcommunity.memberCount ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/subcommunities")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div
          className={`h-14 w-14 rounded-full ${color} flex items-center justify-center text-white text-xl font-bold shrink-0`}
        >
          {subcommunity.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight truncate">
              {subcommunity.name}
            </h1>
            <Badge variant={subcommunity.isPublic ? "success" : "secondary"}>
              {subcommunity.isPublic ? "Public" : "Private"}
            </Badge>
          </div>
          {subcommunity.description && (
            <p className="text-muted-foreground mt-1">
              {subcommunity.description}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {memberCount} {memberCount === 1 ? "member" : "members"}
            {subcommunity.joinKeyword && (
              <span className="ml-3">
                Keyword:{" "}
                <span className="font-mono font-bold">
                  {subcommunity.joinKeyword}
                </span>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Edit Form (inline card) */}
      {showEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Subcommunity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Name *</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editKeyword">Join Keyword</Label>
                <Input
                  id="editKeyword"
                  value={editKeyword}
                  onChange={(e) =>
                    setEditKeyword(
                      e.target.value.toUpperCase().replace(/\s/g, "")
                    )
                  }
                  className="font-mono uppercase"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="editIsPublic"
                checked={editIsPublic}
                onCheckedChange={setEditIsPublic}
              />
              <Label htmlFor="editIsPublic" className="cursor-pointer">
                {editIsPublic ? "Public" : "Private"}
              </Label>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editName.trim() || saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({membersTotal})
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setShowAddMembers(true);
                setSelectedContacts(new Set());
                setContactSearch("");
                setContactResults([]);
              }}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Add Members
            </Button>
          </div>
          {/* Search bar */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-base font-medium mb-1">
                {searchQuery ? "No matching members" : "No Members Yet"}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                {searchQuery
                  ? "Try a different search term."
                  : "Add contacts to this subcommunity to get started."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-3 font-medium">Name</th>
                      <th className="text-left py-2 px-3 font-medium">
                        Phone
                      </th>
                      <th className="text-left py-2 px-3 font-medium">
                        Joined
                      </th>
                      <th className="text-right py-2 px-3 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member: any) => (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="py-2 px-3">
                          {member.contact.firstName || member.contact.lastName
                            ? `${member.contact.firstName || ""} ${member.contact.lastName || ""}`.trim()
                            : "-"}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">
                          {member.contact.phone}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveMember(member.contact.id)
                            }
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {membersTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {membersPage} of {membersTotalPages} ({membersTotal}{" "}
                    total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={membersPage <= 1}
                      onClick={() => {
                        const prev = membersPage - 1;
                        setMembersPage(prev);
                        loadMembers(prev, searchQuery);
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={membersPage >= membersTotalPages}
                      onClick={() => {
                        const next = membersPage + 1;
                        setMembersPage(next);
                        loadMembers(next, searchQuery);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Members Modal */}
      <Dialog
        open={showAddMembers}
        onOpenChange={(open) => {
          setShowAddMembers(open);
          if (!open) {
            setSelectedContacts(new Set());
            setContactSearch("");
            setContactResults([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Members</DialogTitle>
            <DialogDescription>
              Search for contacts to add to this subcommunity.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Contact search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={contactSearch}
                onChange={(e) => handleSearchContacts(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Selected count */}
            {selectedContacts.size > 0 && (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm">
                <span>
                  {selectedContacts.size} contact
                  {selectedContacts.size !== 1 ? "s" : ""} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedContacts(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Search results */}
            <div className="max-h-[300px] overflow-y-auto border rounded-lg">
              {searchingContacts ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Searching...
                </div>
              ) : contactResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {contactSearch
                    ? "No contacts found"
                    : "Type to search contacts"}
                </div>
              ) : (
                <div className="divide-y">
                  {contactResults.map((contact) => {
                    const isSelected = selectedContacts.has(contact.id);
                    return (
                      <div
                        key={contact.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                        onClick={() => toggleContactSelection(contact.id)}
                      >
                        <div
                          className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-primary border-primary" : "border-input"}`}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {contact.firstName || contact.lastName
                              ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
                              : "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {contact.phone}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddMembers(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSelectedMembers}
              disabled={selectedContacts.size === 0 || addingMembers}
            >
              {addingMembers
                ? "Adding..."
                : `Add ${selectedContacts.size || ""} Member${selectedContacts.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
