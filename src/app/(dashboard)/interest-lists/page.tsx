"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  listInterestListsAction,
  getInterestListAction,
  createInterestListAction,
  updateInterestListAction,
  deleteInterestListAction,
  removeMemberAction,
  addMemberAction,
} from "@/server/actions/interest-lists";
import {
  Plus,
  Users,
  Hash,
  MessageSquare,
  Trash2,
  ArrowLeft,
  UserMinus,
  UserPlus,
  Power,
  PowerOff,
} from "lucide-react";

export default function InterestListsPage() {
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedList, setSelectedList] = useState<any>(null);
  const [, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  // Create form
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [description, setDescription] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [creating, setCreating] = useState(false);

  // Add member
  const [addContactId, setAddContactId] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadLists();
  }, []);

  async function loadLists() {
    setLoading(true);
    try {
      const data = await listInterestListsAction();
      setLists(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(listId: string) {
    setDetailLoading(true);
    try {
      const data = await getInterestListAction(listId);
      setSelectedList(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      await createInterestListAction({
        name,
        keyword,
        description: description || undefined,
        welcomeMessage: welcomeMessage || undefined,
      });
      setName("");
      setKeyword("");
      setDescription("");
      setWelcomeMessage("");
      setShowCreate(false);
      toast.success("Interest list created successfully");
      await loadLists();
    } catch (err: any) {
      toast.error(err.message || "Failed to create interest list");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(listId: string, isActive: boolean) {
    try {
      await updateInterestListAction(listId, { isActive: !isActive });
      toast.success(`List ${isActive ? "deactivated" : "activated"}`);
      await loadLists();
      if (selectedList?.id === listId) {
        await loadDetail(listId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update list");
    }
  }

  async function handleDelete(listId: string) {
    if (!confirm("Delete this interest list? Members will be removed but contacts will remain.")) return;
    try {
      await deleteInterestListAction(listId);
      if (selectedList?.id === listId) setSelectedList(null);
      toast.success("Interest list deleted");
      await loadLists();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete interest list");
    }
  }

  async function handleRemoveMember(contactId: string) {
    if (!selectedList) return;
    try {
      await removeMemberAction(selectedList.id, contactId);
      toast.success("Member removed");
      await loadDetail(selectedList.id);
      await loadLists();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  }

  async function handleAddMember() {
    if (!selectedList || !addContactId.trim()) return;
    setAdding(true);
    setError("");
    try {
      await addMemberAction(selectedList.id, addContactId.trim());
      setAddContactId("");
      toast.success("Member added successfully");
      await loadDetail(selectedList.id);
      await loadLists();
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    } finally {
      setAdding(false);
    }
  }

  // Detail view
  if (selectedList) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedList(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{selectedList.name}</h1>
              <Badge variant={selectedList.isActive ? "success" : "secondary"}>
                {selectedList.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            {selectedList.description && (
              <p className="text-muted-foreground mt-1">{selectedList.description}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleToggleActive(selectedList.id, selectedList.isActive)}
          >
            {selectedList.isActive ? (
              <><PowerOff className="h-4 w-4 mr-1" /> Deactivate</>
            ) : (
              <><Power className="h-4 w-4 mr-1" /> Activate</>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDelete(selectedList.id)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* List Info */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Hash className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Keyword</p>
                  <p className="font-mono font-bold text-lg">{selectedList.keyword}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-info/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Members</p>
                  <p className="font-bold text-lg">{selectedList.members?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Welcome Message</p>
                  <p className="text-sm truncate max-w-[200px]">
                    {selectedList.welcomeMessage || "Default"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card>
          <CardContent className="pt-6">
            <div className="bg-info/10 border border-info/30 rounded-lg p-4 text-sm text-info">
              <p className="font-medium mb-1">How people join this list</p>
              <p>
                Anyone who texts <span className="font-mono font-bold">{selectedList.keyword}</span> to
                your number will be automatically added to this list and opted in.
                {selectedList.welcomeMessage
                  ? " They'll receive your custom welcome message."
                  : " They'll receive a default confirmation message."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Add Member */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Member Manually</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={addContactId}
                onChange={(e) => setAddContactId(e.target.value)}
                placeholder="Contact ID"
                className="flex-1"
              />
              <Button onClick={handleAddMember} disabled={!addContactId.trim() || adding}>
                <UserPlus className="h-4 w-4 mr-1" />
                {adding ? "Adding..." : "Add"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              You can also add contacts from the Contacts page.
            </p>
          </CardContent>
        </Card>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Members ({selectedList.members?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedList.members?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-base font-medium mb-1">No Members Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Share your keyword to start building this list. People can text <span className="font-mono font-bold">{selectedList.keyword}</span> to join.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-3 font-medium">Name</th>
                      <th className="text-left py-2 px-3 font-medium">Phone</th>
                      <th className="text-left py-2 px-3 font-medium">Source</th>
                      <th className="text-left py-2 px-3 font-medium">Joined</th>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-right py-2 px-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedList.members?.map((member: any) => (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="py-2 px-3">
                          {member.contact.firstName || member.contact.lastName
                            ? `${member.contact.firstName || ""} ${member.contact.lastName || ""}`.trim()
                            : "-"}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{member.contact.phone}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-xs">
                            {member.source}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant={
                              member.contact.optInStatus === "OPTED_IN"
                                ? "success"
                                : member.contact.optInStatus === "OPTED_OUT"
                                  ? "destructive"
                                  : "warning"
                            }
                            className="text-xs"
                          >
                            {member.contact.optInStatus?.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.contact.id)}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
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
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interest Lists</h1>
          <p className="text-muted-foreground">
            Let people join lists by texting a keyword to your number.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create List
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Interest List</CardTitle>
            <CardDescription>
              People can join this list by texting a keyword to your number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="listName">List Name *</Label>
                <Input
                  id="listName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Volunteers, Event Updates"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyword">Keyword *</Label>
                <Input
                  id="keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value.toUpperCase().replace(/\s/g, ""))}
                  placeholder="e.g., VOLUNTEER, EVENTS"
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  People text this word to your number to join. Not case sensitive.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="listDescription">Description (optional)</Label>
              <Input
                id="listDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Internal description for your team"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcomeMsg">Welcome Message (optional)</Label>
              <Textarea
                id="welcomeMsg"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Thanks for joining! You'll receive updates about..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Auto-reply sent when someone joins. Leave blank for a default message.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setName("");
                setKeyword("");
                setDescription("");
                setWelcomeMessage("");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || !keyword.trim() || creating}>
              {creating ? "Creating..." : "Create List"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Lists Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-48 mt-2" />
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : lists.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Hash className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium mb-1">No Interest Lists Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Create an interest list and assign a keyword. People can text that keyword
              to your number to automatically join the list and opt in.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First List
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Card
              key={list.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => loadDetail(list.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{list.name}</CardTitle>
                  <Badge variant={list.isActive ? "success" : "secondary"} className="text-xs">
                    {list.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {list.description && (
                  <CardDescription className="text-xs">{list.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono font-bold">{list.keyword}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{list._count?.members || 0} members</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
