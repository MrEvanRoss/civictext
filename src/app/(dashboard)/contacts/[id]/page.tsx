"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MediaUpload } from "@/components/ui/media-upload";
import {
  getContactAction,
  updateContactAction,
  deleteContactAction,
  getContactTimelineAction,
  getContactNotesAction,
  addContactNoteAction,
  deleteContactNoteAction,
} from "@/server/actions/contacts";
import {
  getContactInterestListsAction,
  listInterestListsAction,
  addMemberAction,
  removeMemberAction,
} from "@/server/actions/interest-lists";
import { quickSendAction } from "@/server/actions/inbox";
import { ArrowLeft, Save, Trash2, Send, MessageSquare, StickyNote, ShieldCheck, ArrowDownLeft, ArrowUpRight, Hash, Plus, X } from "lucide-react";

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    prefix: "",
    firstName: "",
    lastName: "",
    suffix: "",
    email: "",
    dateOfBirth: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    precinct: "",
    tags: "",
    optInStatus: "",
  });
  const [quickMessage, setQuickMessage] = useState("");
  const [quickMediaUrl, setQuickMediaUrl] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendSuccess, setSendSuccess] = useState("");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Notes
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Interest Lists
  const [memberLists, setMemberLists] = useState<any[]>([]);
  const [allLists, setAllLists] = useState<any[]>([]);
  const [showAddList, setShowAddList] = useState(false);
  const [addListId, setAddListId] = useState("");

  useEffect(() => {
    loadContact();
    loadTimeline();
    loadNotes();
    loadInterestLists();
  }, [contactId]);

  async function loadTimeline() {
    setTimelineLoading(true);
    try {
      const data = await getContactTimelineAction(contactId);
      setTimeline(data);
    } catch {
      // Timeline is non-critical
    } finally {
      setTimelineLoading(false);
    }
  }

  async function loadNotes() {
    try {
      const data = await getContactNotesAction(contactId);
      setNotes(data);
    } catch {
      // Non-critical
    }
  }

  async function loadInterestLists() {
    try {
      const [memberData, allData] = await Promise.all([
        getContactInterestListsAction(contactId),
        listInterestListsAction(),
      ]);
      setMemberLists(memberData);
      setAllLists(allData);
    } catch {
      // Non-critical
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await addContactNoteAction(contactId, newNote.trim());
      setNewNote("");
      await loadNotes();
      await loadTimeline();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteContactNoteAction(noteId);
      await loadNotes();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleAddToList() {
    if (!addListId) return;
    try {
      await addMemberAction(addListId, contactId);
      setAddListId("");
      setShowAddList(false);
      await loadInterestLists();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRemoveFromList(listId: string) {
    if (!confirm("Remove contact from this interest list?")) return;
    try {
      await removeMemberAction(listId, contactId);
      await loadInterestLists();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function loadContact() {
    try {
      const data = await getContactAction(contactId);
      if (!data) {
        router.push("/contacts");
        return;
      }
      setContact(data);
      setForm({
        prefix: data.prefix || "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        suffix: data.suffix || "",
        email: data.email || "",
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split("T")[0] : "",
        street: data.street || "",
        city: data.city || "",
        state: data.state || "",
        zip: data.zip || "",
        precinct: data.precinct || "",
        tags: data.tags.join(", "),
        optInStatus: data.optInStatus,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await updateContactAction({
        id: contactId,
        prefix: form.prefix || undefined,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        suffix: form.suffix || undefined,
        email: form.email || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        street: form.street || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zip: form.zip || undefined,
        precinct: form.precinct || undefined,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        optInStatus: form.optInStatus as any,
      });
      await loadContact();
    } catch (err: any) {
      setError(err.message || "Failed to update contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickSend() {
    if (!quickMessage.trim() && !quickMediaUrl) return;
    setSendingMessage(true);
    setSendSuccess("");
    setError("");
    try {
      await quickSendAction({
        contactId,
        body: quickMessage.trim(),
        mediaUrl: quickMediaUrl || undefined,
      });
      setQuickMessage("");
      setQuickMediaUrl("");
      setSendSuccess("Message queued for delivery.");
      await loadContact();
      setTimeout(() => setSendSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Permanently delete this contact? Message history will be anonymized.")) return;
    try {
      await deleteContactAction(contactId);
      router.push("/contacts");
    } catch (err: any) {
      setError(err.message || "Failed to delete contact");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {contact.firstName || contact.lastName
              ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
              : contact.phone}
          </h1>
          <p className="text-muted-foreground font-mono">{contact.phone}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
            <CardDescription>Update contact information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prefix">Prefix</Label>
                <Input
                  id="prefix"
                  value={form.prefix}
                  onChange={(e) => setForm((p) => ({ ...p, prefix: e.target.value }))}
                  placeholder="Mr."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suffix">Suffix</Label>
                <Input
                  id="suffix"
                  value={form.suffix}
                  onChange={(e) => setForm((p) => ({ ...p, suffix: e.target.value }))}
                  placeholder="Jr."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                value={form.street}
                onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                  maxLength={2}
                  placeholder="NY"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  value={form.zip}
                  onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))}
                  maxLength={10}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="precinct">Precinct</Label>
              <Input
                id="precinct"
                value={form.precinct}
                onChange={(e) => setForm((p) => ({ ...p, precinct: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                placeholder="volunteer, donor, district-5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="optInStatus">Consent Status</Label>
              <Select
                id="optInStatus"
                value={form.optInStatus}
                onChange={(e) => setForm((p) => ({ ...p, optInStatus: e.target.value }))}
              >
                <option value="OPTED_IN">Opted In</option>
                <option value="PENDING">Pending</option>
                <option value="OPTED_OUT">Opted Out</option>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>

        {/* Message History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
            <CardDescription>Last 20 messages with this contact.</CardDescription>
          </CardHeader>
          <CardContent>
            {contact.messages?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {contact.messages?.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.direction === "OUTBOUND"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p>{msg.body}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.direction === "OUTBOUND"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleString()}
                        {msg.status && (
                          <span className="ml-2">&middot; {msg.status}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Send */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Send Message</CardTitle>
            <CardDescription>
              Send a quick text message to this contact.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {contact.optInStatus === "OPTED_OUT" ? (
              <p className="text-sm text-destructive">
                This contact has opted out and cannot receive messages.
              </p>
            ) : (
              <>
                {/* MMS Attachment */}
                {quickMediaUrl ? (
                  <MediaUpload
                    value={quickMediaUrl}
                    onUpload={(url) => setQuickMediaUrl(url)}
                    onRemove={() => setQuickMediaUrl("")}
                  />
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-muted-foreground/25">
                    <MediaUpload
                      value=""
                      onUpload={(url) => setQuickMediaUrl(url)}
                      onRemove={() => setQuickMediaUrl("")}
                    />
                  </div>
                )}
                <Textarea
                  value={quickMessage}
                  onChange={(e) => setQuickMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {quickMessage.length} characters
                    {quickMessage.length > 160 && ` (${Math.ceil(quickMessage.length / 153)} segments)`}
                    {quickMediaUrl && " + MMS attachment"}
                  </p>
                  <div className="flex items-center gap-2">
                    {sendSuccess && (
                      <p className="text-sm text-green-600">{sendSuccess}</p>
                    )}
                    <Button
                      onClick={handleQuickSend}
                      disabled={(!quickMessage.trim() && !quickMediaUrl) || sendingMessage}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sendingMessage ? "Sending..." : quickMediaUrl ? "Send MMS" : "Send"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Contact Metadata */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Consent History</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <Badge
                    variant={
                      contact.optInStatus === "OPTED_IN"
                        ? "success"
                        : contact.optInStatus === "OPTED_OUT"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {contact.optInStatus}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="mt-1">{contact.optInSource || "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Opted In</dt>
                <dd className="mt-1">
                  {contact.optInTimestamp
                    ? new Date(contact.optInTimestamp).toLocaleString()
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Opted Out</dt>
                <dd className="mt-1">
                  {contact.optOutTimestamp
                    ? new Date(contact.optOutTimestamp).toLocaleString()
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-1">
                  {new Date(contact.createdAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Message</dt>
                <dd className="mt-1">
                  {contact.lastMessageAt
                    ? new Date(contact.lastMessageAt).toLocaleString()
                    : "Never"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Interest Lists & Notes side by side */}
      <div className="grid grid-cols-2 gap-6">
        {/* Interest Lists */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Interest Lists
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddList(!showAddList)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add to List
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAddList && (
              <div className="flex gap-2 mb-4">
                <Select
                  value={addListId}
                  onChange={(e) => setAddListId(e.target.value)}
                  className="flex-1"
                >
                  <option value="">Select a list...</option>
                  {allLists
                    .filter((l: any) => !memberLists.some((m: any) => m.interestList.id === l.id))
                    .map((l: any) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.keyword})</option>
                    ))}
                </Select>
                <Button size="sm" onClick={handleAddToList} disabled={!addListId}>Add</Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowAddList(false); setAddListId(""); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {memberLists.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not on any interest lists.</p>
            ) : (
              <div className="space-y-2">
                {memberLists.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{m.interestList.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{m.interestList.keyword}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-7"
                      onClick={() => handleRemoveFromList(m.interestList.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this contact..."
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
              />
              <Button size="sm" onClick={handleAddNote} disabled={addingNote || !newNote.trim()}>
                {addingNote ? "Adding..." : "Add"}
              </Button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {notes.map((note: any) => (
                  <div key={note.id} className="p-3 rounded-lg border text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        {note.author?.name || "Team"} &middot; {new Date(note.createdAt).toLocaleString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p>{note.body}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Recent messages, notes, and consent changes.</CardDescription>
        </CardHeader>
        <CardContent>
          {timelineLoading ? (
            <p className="text-muted-foreground text-sm">Loading timeline...</p>
          ) : timeline.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {timeline.slice(0, 30).map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 shrink-0">
                    {item.type === "message" ? (
                      item.direction === "INBOUND" ? (
                        <ArrowDownLeft className="h-4 w-4 text-blue-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                      )
                    ) : item.type === "note" ? (
                      <StickyNote className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-purple-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {item.type === "message"
                          ? item.direction === "INBOUND" ? "Received" : "Sent"
                          : item.type === "note"
                          ? `Note by ${item.authorName || "Team"}`
                          : `${item.action}`}
                      </span>
                      {item.campaignName && (
                        <Badge variant="outline" className="text-xs">{item.campaignName}</Badge>
                      )}
                      {item.source && (
                        <Badge variant="outline" className="text-xs">{item.source}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {new Date(item.date).toLocaleString()}
                      </span>
                    </div>
                    {item.body && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
