"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  listConversationsAction,
  getConversationMessagesAction,
  sendReplyAction,
  addNoteAction,
  addContactNoteAction,
  exportConversationAction,
  exportAllConversationsAction,
  escalateConversationAction,
  resolveEscalationAction,
  tagConversationAction,
  assignConversationAction,
  getTeamMembersAction,
  listQuickRepliesAction,
  closeConversationAction,
  reopenConversationAction,
} from "@/server/actions/inbox";
import { MediaUpload } from "@/components/ui/media-upload";
import {
  Inbox,
  Send,
  StickyNote,
  User,
  Download,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Tag,
  FileText,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  XCircle,
  RotateCcw,
} from "lucide-react";

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unassigned" | "mine">("all");
  const [replyText, setReplyText] = useState("");
  const [replyMediaUrl, setReplyMediaUrl] = useState("");
  const [noteText, setNoteText] = useState("");
  const [contactNoteText, setContactNoteText] = useState("");
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [escalateReason, setEscalateReason] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);
  const [responseTagInput, setResponseTagInput] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  useEffect(() => {
    loadConversations();
    loadTeamMembers();
    loadQuickReplies();
  }, [filter]);

  async function loadTeamMembers() {
    try {
      const data = await getTeamMembersAction();
      setTeamMembers(data);
    } catch (err) {
      // Non-critical
    }
  }

  async function loadQuickReplies() {
    try {
      const data = await listQuickRepliesAction();
      setQuickReplies(data);
    } catch {
      // Non-critical
    }
  }

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
  }, [selectedId]);

  async function loadConversations() {
    setLoading(true);
    try {
      const data = await listConversationsAction({ filter });
      setConversations(data.conversations);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(id: string) {
    try {
      const data = await getConversationMessagesAction(id);
      setThread(data);
    } catch (err) {
      console.error("Failed to load thread:", err);
    }
  }

  async function handleSendReply() {
    if (!selectedId || (!replyText.trim() && !replyMediaUrl)) return;
    setSending(true);
    try {
      await sendReplyAction(selectedId, replyText.trim(), replyMediaUrl || undefined);
      setReplyText("");
      setReplyMediaUrl("");
      await loadThread(selectedId);
      await loadConversations();
    } catch (err: any) {
      alert(err.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  function downloadCsv(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportConversation() {
    if (!selectedId) return;
    try {
      const { csv, filename } = await exportConversationAction(selectedId);
      downloadCsv(csv, filename);
    } catch (err: any) {
      alert(err.message || "Failed to export conversation");
    }
  }

  async function handleCloseConversation() {
    if (!selectedId) return;
    try {
      await closeConversationAction(selectedId);
      await loadThread(selectedId);
      await loadConversations();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleReopenConversation() {
    if (!selectedId) return;
    try {
      await reopenConversationAction(selectedId);
      await loadThread(selectedId);
      await loadConversations();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleExportAll() {
    try {
      const { csv, filename } = await exportAllConversationsAction();
      downloadCsv(csv, filename);
    } catch (err: any) {
      alert(err.message || "Failed to export conversations");
    }
  }

  async function handleAddNote() {
    if (!selectedId || !noteText.trim()) return;
    try {
      await addNoteAction(selectedId, noteText.trim());
      setNoteText("");
      await loadThread(selectedId);
    } catch (err: any) {
      alert(err.message || "Failed to add note");
    }
  }

  async function handleAddContactNote() {
    if (!thread?.conversation?.contact?.id || !contactNoteText.trim()) return;
    try {
      await addContactNoteAction(thread.conversation.contact.id, contactNoteText.trim());
      setContactNoteText("");
      await loadThread(selectedId!);
    } catch (err: any) {
      alert(err.message || "Failed to add note");
    }
  }

  async function handleEscalate() {
    if (!selectedId || !escalateReason.trim()) return;
    try {
      await escalateConversationAction(selectedId, escalateReason.trim());
      setEscalateReason("");
      setShowEscalate(false);
      await loadThread(selectedId);
      await loadConversations();
    } catch (err: any) {
      alert(err.message || "Failed to escalate");
    }
  }

  async function handleResolveEscalation() {
    if (!selectedId) return;
    try {
      await resolveEscalationAction(selectedId);
      await loadThread(selectedId);
      await loadConversations();
    } catch (err: any) {
      alert(err.message || "Failed to resolve");
    }
  }

  async function handleAddResponseTag() {
    if (!selectedId || !responseTagInput.trim()) return;
    const currentTags = thread?.conversation?.responseTags || [];
    const newTag = responseTagInput.trim().toLowerCase();
    if (currentTags.includes(newTag)) {
      setResponseTagInput("");
      return;
    }
    try {
      await tagConversationAction(selectedId, [...currentTags, newTag]);
      setResponseTagInput("");
      await loadThread(selectedId);
    } catch (err: any) {
      alert(err.message || "Failed to tag");
    }
  }

  async function handleRemoveResponseTag(tag: string) {
    if (!selectedId) return;
    const currentTags = thread?.conversation?.responseTags || [];
    try {
      await tagConversationAction(selectedId, currentTags.filter((t: string) => t !== tag));
      await loadThread(selectedId);
    } catch (err: any) {
      alert(err.message || "Failed to remove tag");
    }
  }

  async function handleAssign(userId: string | null) {
    if (!selectedId) return;
    try {
      await assignConversationAction(selectedId, userId);
      await loadThread(selectedId);
      await loadConversations();
    } catch (err: any) {
      alert(err.message || "Failed to assign");
    }
  }

  const contact = thread?.conversation?.contact;

  return (
    <div className="flex h-[calc(100vh-4rem)] -mt-6 -mx-6">
      {/* Thread List (Left Panel) */}
      <div className="w-80 border-r flex flex-col shrink-0">
        <div className="p-4 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Inbox</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              title="Export all conversations"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-sm"
          >
            <option value="all">All Conversations</option>
            <option value="mine">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
            <option value="escalated">Escalated</option>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Inbox className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground text-center">
                No conversations yet. Inbound messages will appear here.
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`p-3 border-b cursor-pointer hover:bg-muted/50 ${
                  selectedId === conv.id ? "bg-muted" : ""
                }`}
                onClick={() => setSelectedId(conv.id)}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">
                    {conv.contact?.firstName
                      ? `${conv.contact.firstName} ${conv.contact.lastName || ""}`.trim()
                      : conv.contact?.phone}
                  </p>
                  {conv.state === "OPEN" && conv.lastMessageAt > 0 && (
                    <Badge variant="default" className="text-xs">
                      {conv.state === "OPEN" && conv.lastMessageAt}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1">
                  {"View conversation"}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    {conv.lastMessageAt
                      ? new Date(conv.lastMessageAt).toLocaleString()
                      : ""}
                  </p>
                  {conv.assignedTo && (
                    <span className="text-xs text-muted-foreground">
                      {conv.assignedTo.name}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Thread (Center Panel) */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">
              Select a conversation to view messages.
            </p>
          </div>
        ) : !thread ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {contact?.firstName
                      ? `${contact.firstName} ${contact.lastName || ""}`.trim()
                      : contact?.phone}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {contact?.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!thread?.conversation?.isEscalated ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEscalate(!showEscalate)}
                    title="Escalate for supervisor review"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Escalate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResolveEscalation}
                    title="Resolve escalation"
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                )}
                {thread?.conversation?.state === "CLOSED" ? (
                  <Button variant="outline" size="sm" onClick={handleReopenConversation} title="Reopen conversation">
                    <RotateCcw className="h-3 w-3 mr-1" /> Reopen
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleCloseConversation} title="Close conversation">
                    <XCircle className="h-3 w-3 mr-1" /> Close
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportConversation}
                  title="Export this conversation"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSidebar(!showSidebar)}
                  title={showSidebar ? "Hide contact info" : "Show contact info"}
                >
                  {showSidebar ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Escalation Banner */}
            {thread?.conversation?.isEscalated && (
              <div className="px-4 py-2 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-800 font-medium">Escalated</span>
                {thread.conversation.escalatedReason && (
                  <span className="text-sm text-orange-700">
                    &mdash; {thread.conversation.escalatedReason}
                  </span>
                )}
              </div>
            )}

            {/* Escalation Input */}
            {showEscalate && (
              <div className="px-4 py-2 border-b bg-orange-50/50 flex items-center gap-2">
                <Input
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="Reason for escalation..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleEscalate();
                    }
                  }}
                />
                <Button size="sm" onClick={handleEscalate} disabled={!escalateReason.trim()}>
                  Escalate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowEscalate(false)}>
                  Cancel
                </Button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {thread.messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
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
                    </p>
                  </div>
                </div>
              ))}

              {/* Internal Notes */}
              {thread.notes.map((note: any) => (
                <div key={note.id} className="flex justify-center">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs max-w-[80%]">
                    <div className="flex items-center gap-1 text-yellow-700 mb-1">
                      <StickyNote className="h-3 w-3" />
                      <span className="font-medium">{note.author?.name}</span>
                    </div>
                    <p className="text-yellow-800">{note.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply / Note Input */}
            <div className="p-4 border-t space-y-2">
              {/* Quick Reply Templates */}
              {quickReplies.length > 0 && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className="text-xs text-muted-foreground"
                  >
                    Quick Replies ({quickReplies.length})
                  </Button>
                  {showQuickReplies && (
                    <div className="absolute bottom-full left-0 mb-1 w-72 max-h-48 overflow-y-auto bg-popover border rounded-lg shadow-lg z-10">
                      {quickReplies.map((qr) => (
                        <button
                          key={qr.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                          onClick={() => {
                            setReplyText(qr.body);
                            setShowQuickReplies(false);
                          }}
                        >
                          <span className="font-medium">{qr.name}</span>
                          <p className="text-xs text-muted-foreground line-clamp-1">{qr.body}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* MMS Attachment Preview */}
              {replyMediaUrl && (
                <MediaUpload
                  value={replyMediaUrl}
                  onUpload={(url) => setReplyMediaUrl(url)}
                  onRemove={() => setReplyMediaUrl("")}
                  compact
                />
              )}
              <div className="flex gap-2">
                {/* Attachment button */}
                {!replyMediaUrl && (
                  <MediaUpload
                    value=""
                    onUpload={(url) => setReplyMediaUrl(url)}
                    onRemove={() => setReplyMediaUrl("")}
                    compact
                    className="self-end"
                  />
                )}
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a reply..."
                  rows={2}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={(!replyText.trim() && !replyMediaUrl) || sending}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add internal note (team only)..."
                  className="flex-1 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                >
                  <StickyNote className="h-3 w-3 mr-1" />
                  Note
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contact Info Sidebar (Right Panel) */}
      {selectedId && thread && showSidebar && (
        <div className="w-80 border-l flex flex-col shrink-0 overflow-y-auto bg-card">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">Contact Info</h3>
          </div>

          <div className="p-4 space-y-5">
            {/* Name & Avatar */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {contact?.firstName || contact?.lastName
                    ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
                    : "Unknown"}
                </p>
                <Badge
                  variant={
                    contact?.optInStatus === "OPTED_IN"
                      ? "success"
                      : contact?.optInStatus === "OPTED_OUT"
                        ? "destructive"
                        : "warning"
                  }
                  className="text-xs mt-1"
                >
                  {contact?.optInStatus?.replace("_", " ")}
                </Badge>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-mono">{contact?.phone}</span>
              </div>

              {contact?.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}

              {contact?.dateOfBirth && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{new Date(contact.dateOfBirth).toLocaleDateString()}</span>
                </div>
              )}

              {(contact?.street || contact?.city || contact?.state || contact?.zip) && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    {contact.street && <p>{contact.street}</p>}
                    <p>
                      {[contact.city, contact.state].filter(Boolean).join(", ")}
                      {contact.zip ? ` ${contact.zip}` : ""}
                    </p>
                  </div>
                </div>
              )}

              {contact?.precinct && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Precinct: {contact.precinct}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {contact?.tags?.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Assignment */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Assigned To</p>
              <Select
                value={thread?.conversation?.assignedToId || ""}
                onChange={(e) => handleAssign(e.target.value || null)}
                className="text-sm"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member: any) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </Select>
            </div>

            {/* Response Tags */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Response Tags</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {thread?.conversation?.responseTags?.map((tag: string) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-destructive/20"
                    onClick={() => handleRemoveResponseTag(tag)}
                    title="Click to remove"
                  >
                    {tag} &times;
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={responseTagInput}
                  onChange={(e) => setResponseTagInput(e.target.value)}
                  placeholder="Add tag..."
                  className="flex-1 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddResponseTag();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddResponseTag}
                  disabled={!responseTagInput.trim()}
                >
                  <Tag className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {["supportive", "undecided", "opposed", "volunteer", "donor", "needs-info"].map(
                  (preset) => (
                    <button
                      key={preset}
                      className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-dashed hover:border-solid transition-colors"
                      onClick={() => {
                        setResponseTagInput(preset);
                        handleAddResponseTag();
                      }}
                    >
                      {preset}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Consent History */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Consent</p>
              <dl className="space-y-1 text-xs">
                {contact?.optInSource && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Source</dt>
                    <dd>{contact.optInSource}</dd>
                  </div>
                )}
                {contact?.optInTimestamp && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Opted In</dt>
                    <dd>{new Date(contact.optInTimestamp).toLocaleDateString()}</dd>
                  </div>
                )}
                {contact?.optOutTimestamp && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Opted Out</dt>
                    <dd>{new Date(contact.optOutTimestamp).toLocaleDateString()}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Added</dt>
                  <dd>{new Date(contact?.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </div>

            {/* Contact Notes */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Notes About Contact</p>

              <div className="flex gap-2 mb-3">
                <Input
                  value={contactNoteText}
                  onChange={(e) => setContactNoteText(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddContactNote();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddContactNote}
                  disabled={!contactNoteText.trim()}
                >
                  Add
                </Button>
              </div>

              {contact?.contactNotes?.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {contact.contactNotes.map((note: any) => (
                    <div key={note.id} className="bg-muted/50 rounded p-2 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{note.author?.name}</span>
                        <span className="text-muted-foreground">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p>{note.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No notes yet.</p>
              )}
            </div>

            {/* Message Stats */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Activity</p>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Messages in thread</dt>
                  <dd className="font-medium">{thread.messages.length}</dd>
                </div>
                {contact?.lastMessageAt && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Last message</dt>
                    <dd>{new Date(contact.lastMessageAt).toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
