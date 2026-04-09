"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
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
import { bulkAddTagsAction, updateContactAction } from "@/server/actions/contacts";
import { countSegments, getSegmentLimit } from "@/lib/sms-utils";
import { MediaUpload } from "@/components/ui/media-upload";
import {
  Inbox,
  Send,
  StickyNote,
  User,
  Download,
  Mail,
  MapPin,
  Calendar,
  Tag,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  ArrowDown,
  Check,
  CheckCheck,
  X,
  ChevronDown,
  ArrowLeft,
  Plus,
  UserX,
} from "lucide-react";

interface InboxContact {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  tags: string[];
  contactNotes?: {
    id: string;
    body: string;
    createdAt: Date | string;
    author: { name: string | null } | null;
    [key: string]: unknown;
  }[];
}

interface Conversation {
  id: string;
  contactId: string;
  lastMessageAt: Date | string | null;
  lastMessageBody?: string | null;
  unreadCount?: number;
  state: string;
  isEscalated: boolean;
  escalatedReason: string | null;
  responseTags: string[];
  assignedToId: string | null;
  contact: InboxContact;
  assignedTo: { name: string | null } | null;
  [key: string]: unknown;
}

interface ThreadMessage {
  id: string;
  direction: string;
  body: string | null;
  mediaUrl: string | null;
  status: string;
  createdAt: Date | string;
  campaign: { id: string; name: string; type: string } | null;
  [key: string]: unknown;
}

interface ConversationNote {
  id: string;
  body: string;
  createdAt: Date | string;
  author: { name: string | null } | null;
}

interface ThreadData {
  conversation: Conversation;
  messages: ThreadMessage[];
  notes: ConversationNote[];
}

interface TeamMember {
  id: string;
  name: string | null;
  role: string;
}

interface QuickReply {
  id: string;
  name: string;
  body: string;
}

function relativeTime(dateVal: Date | string): string {
  const now = Date.now();
  const then = new Date(dateVal).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateVal).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getInitials(contact: InboxContact | null | undefined): string {
  if (contact?.firstName) {
    return `${contact.firstName[0]}${contact.lastName?.[0] || ""}`.toUpperCase();
  }
  return contact?.phone?.slice(-2) || "?";
}

function getContactName(contact: InboxContact | null | undefined): string {
  if (contact?.firstName) {
    return `${contact.firstName} ${contact.lastName || ""}`.trim();
  }
  return contact?.phone || "Unknown";
}

function DeliveryIcon({ status }: { status: string }) {
  switch (status) {
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-primary-foreground/60" />;
    case "sent":
      return <Check className="h-3 w-3 text-primary-foreground/60" />;
    case "failed":
    case "undelivered":
      return <X className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unassigned" | "mine">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyMediaUrl, setReplyMediaUrl] = useState("");
  const [noteText, setNoteText] = useState("");
  const [contactNoteText, setContactNoteText] = useState("");
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);
  const [responseTagInput, setResponseTagInput] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listConversationsAction({ filter });
      setConversations(data.conversations);
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadConversations();
    loadTeamMembers();
    loadQuickReplies();
  }, [loadConversations]);

  async function loadTeamMembers() {
    try {
      const data = await getTeamMembersAction();
      setTeamMembers(data);
    } catch {}
  }

  async function loadQuickReplies() {
    try {
      const data = await listQuickRepliesAction();
      setQuickReplies(data);
    } catch {}
  }

  const loadThread = useCallback(async (id: string) => {
    try {
      const data = await getConversationMessagesAction(id);
      setThread(data);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => scrollToBottom(), 100);
    } catch {
      toast.error("Failed to load thread");
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
  }, [selectedId, loadThread]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollBtn(!atBottom);
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
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
      toast.success("Conversation exported");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export");
    }
  }

  async function handleCloseConversation() {
    if (!selectedId) return;
    try {
      await closeConversationAction(selectedId);
      await loadThread(selectedId);
      await loadConversations();
      toast.success("Conversation closed");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    }
  }

  async function handleReopenConversation() {
    if (!selectedId) return;
    try {
      await reopenConversationAction(selectedId);
      await loadThread(selectedId);
      await loadConversations();
      toast.success("Conversation reopened");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    }
  }

  async function handleExportAll() {
    try {
      const { csv, filename } = await exportAllConversationsAction();
      downloadCsv(csv, filename);
      toast.success("All conversations exported");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export");
    }
  }

  async function handleAddNote() {
    if (!selectedId || !noteText.trim()) return;
    try {
      await addNoteAction(selectedId, noteText.trim());
      setNoteText("");
      await loadThread(selectedId);
      toast.success("Note added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
    }
  }

  async function handleAddContactNote() {
    if (!thread?.conversation?.contact?.id || !contactNoteText.trim()) return;
    try {
      await addContactNoteAction(thread.conversation.contact.id, contactNoteText.trim());
      setContactNoteText("");
      await loadThread(selectedId!);
      toast.success("Contact note added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
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
      toast.success("Conversation escalated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to escalate");
    }
  }

  async function handleResolveEscalation() {
    if (!selectedId) return;
    try {
      await resolveEscalationAction(selectedId);
      await loadThread(selectedId);
      await loadConversations();
      toast.success("Escalation resolved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to tag");
    }
  }

  async function handleRemoveResponseTag(tag: string) {
    if (!selectedId) return;
    const currentTags = thread?.conversation?.responseTags || [];
    try {
      await tagConversationAction(selectedId, currentTags.filter((t: string) => t !== tag));
      await loadThread(selectedId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove tag");
    }
  }

  async function handleAssign(userId: string | null) {
    if (!selectedId) return;
    try {
      await assignConversationAction(selectedId, userId);
      await loadThread(selectedId);
      await loadConversations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    }
  }

  const contact = thread?.conversation?.contact;

  // Filter conversations by search query
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = getContactName(conv.contact).toLowerCase();
    const phone = conv.contact?.phone?.toLowerCase() || "";
    return name.includes(q) || phone.includes(q);
  });

  // Mobile: show thread if selected
  const mobileShowThread = !!selectedId;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] md:h-[calc(100vh-3.5rem)] -mt-4 md:-mt-6 -mx-4 md:-mx-6">
      {/* Thread List (Left Panel) */}
      <div
        className={`${
          mobileShowThread ? "hidden md:flex" : "flex"
        } w-full md:w-80 border-r flex-col shrink-0`}
      >
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Inbox</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportAll}
              aria-label="Export all conversations"
              className="text-muted-foreground"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-8 h-8 text-sm"
              aria-label="Search conversations"
            />
          </div>
          <NativeSelect
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-sm h-8"
            aria-label="Filter conversations"
          >
            <option value="all">All Conversations</option>
            <option value="mine">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
            <option value="escalated">Escalated</option>
          </NativeSelect>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-2 space-y-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-3 flex gap-3 animate-fade-in">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                <Inbox className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium">No conversations</p>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {searchQuery ? "Try a different search term" : "Inbound messages will appear here"}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-start gap-3 p-3 cursor-pointer transition-all duration-150 border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                  selectedId === conv.id
                    ? "bg-muted border-l-primary"
                    : "border-l-transparent hover:bg-muted/50"
                }`}
                role="button"
                tabIndex={0}
                aria-label={`Conversation with ${getContactName(conv.contact)}`}
                aria-current={selectedId === conv.id ? "true" : undefined}
                onClick={() => setSelectedId(conv.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(conv.id); } }}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                    {getInitials(conv.contact)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">
                      {getContactName(conv.contact)}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {conv.lastMessageAt ? relativeTime(conv.lastMessageAt) : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.lastMessageBody
                      ? conv.lastMessageBody.slice(0, 60)
                      : "No messages"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {conv.state === "CLOSED" && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Closed</span>
                    )}
                    {conv.isEscalated && (
                      <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">Escalated</span>
                    )}
                    {conv.assignedTo && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {conv.assignedTo.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Thread (Center Panel) */}
      <div
        className={`${
          mobileShowThread ? "flex" : "hidden md:flex"
        } flex-1 flex-col min-w-0`}
      >
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <Inbox className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs text-muted-foreground mt-1">Choose from the list to view messages</p>
          </div>
        ) : !thread ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 border-2 border-muted-foreground/40 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile back button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                    {getInitials(contact)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{getContactName(contact)}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{contact?.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!thread?.conversation?.isEscalated ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEscalate(!showEscalate)}
                    aria-label="Escalate conversation"
                    className="text-muted-foreground"
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResolveEscalation}
                    className="text-success"
                    aria-label="Resolve escalation"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
                {thread?.conversation?.state === "CLOSED" ? (
                  <Button variant="ghost" size="sm" onClick={handleReopenConversation} className="text-muted-foreground" aria-label="Reopen conversation">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={handleCloseConversation} className="text-muted-foreground" aria-label="Close conversation">
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleExportConversation} className="text-muted-foreground" aria-label="Export conversation">
                  <Download className="h-4 w-4" />
                </Button>
                {/* Contact info toggle - desktop */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="hidden md:inline-flex text-muted-foreground"
                  aria-label={showSidebar ? "Hide contact info" : "Show contact info"}
                >
                  {showSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </Button>
                {/* Contact info toggle - mobile */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMobileSidebar(true)}
                  className="md:hidden text-muted-foreground"
                  aria-label="Show contact info"
                >
                  <User className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Escalation Banner */}
            {thread?.conversation?.isEscalated && (
              <div role="alert" className="px-4 py-2 bg-warning/10 border-b border-warning/20 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                <span className="text-xs text-warning font-medium">Escalated</span>
                {thread.conversation.escalatedReason && (
                  <span className="text-xs text-warning/80">&mdash; {thread.conversation.escalatedReason}</span>
                )}
              </div>
            )}

            {/* Escalation Input */}
            {showEscalate && (
              <div className="px-4 py-2 border-b bg-warning/5 flex items-center gap-2">
                <Input
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="Reason for escalation..."
                  className="flex-1 text-sm h-8"
                  aria-label="Escalation reason"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEscalate(); } }}
                />
                <Button size="sm" onClick={handleEscalate} disabled={!escalateReason.trim()}>Escalate</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowEscalate(false)}>Cancel</Button>
              </div>
            )}

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-1 relative"
            >
              {thread.messages.map((msg: any, i: number) => {
                const prev = thread.messages[i - 1];
                const sameDirection = prev?.direction === msg.direction;
                const timeDiff = prev ? new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() : Infinity;
                const grouped = sameDirection && timeDiff < 120000;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"} ${grouped ? "" : "mt-3"}`}
                  >
                    <div className={`max-w-[75%] ${msg.direction === "OUTBOUND" ? "flex flex-col items-end" : "flex flex-col items-start"}`}>
                      <div
                        className={`px-3.5 py-2 text-sm ${
                          msg.direction === "OUTBOUND"
                            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                            : "bg-muted rounded-2xl rounded-bl-md"
                        }`}
                      >
                        {msg.mediaUrl && (
                          <Image
                            src={msg.mediaUrl}
                            alt={`${msg.direction === "OUTBOUND" ? "Sent" : "Received"} media attachment`}
                            width={400}
                            height={192}
                            className="rounded-lg max-w-full max-h-48 mb-1.5 cursor-pointer"
                            onClick={() => window.open(msg.mediaUrl, "_blank")}
                            unoptimized
                          />
                        )}
                        {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                        <div className={`flex items-center gap-1 mt-1 ${
                          msg.direction === "OUTBOUND" ? "justify-end" : ""
                        }`}>
                          {msg.campaign?.type === "P2P" && (
                            <span className={`text-[10px] px-1 py-0.5 rounded ${
                              msg.direction === "OUTBOUND"
                                ? "bg-primary-foreground/10 text-primary-foreground/70"
                                : "bg-muted-foreground/10 text-muted-foreground"
                            }`}>
                              P2P
                            </span>
                          )}
                          <span
                            className={`text-[10px] ${
                              msg.direction === "OUTBOUND"
                                ? "text-primary-foreground/60"
                                : "text-muted-foreground"
                            }`}
                          >
                            {!grouped && new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                          {msg.direction === "OUTBOUND" && <DeliveryIcon status={msg.status} />}
                        </div>
                      </div>
                      {msg.campaign && (
                        <span className="text-[10px] text-muted-foreground/60 mt-0.5 px-1 truncate max-w-full">
                          Campaign: {msg.campaign.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Internal Notes */}
              {thread.notes.map((note: any) => (
                <div key={note.id} className="flex justify-center mt-3">
                  <div className="bg-warning/10 border border-warning/20 rounded-xl px-3 py-2 text-xs max-w-[80%]">
                    <div className="flex items-center gap-1 text-warning mb-0.5">
                      <StickyNote className="h-3 w-3" />
                      <span className="font-medium">{note.author?.name}</span>
                    </div>
                    <p className="text-warning/80">{note.body}</p>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />

              {/* Scroll to bottom */}
              {showScrollBtn && (
                <button
                  onClick={scrollToBottom}
                  className="sticky bottom-2 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                  aria-label="Scroll to bottom"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Reply / Note Input */}
            <div className="p-3 border-t space-y-2 bg-background">
              {/* Quick Reply Templates */}
              {quickReplies.length > 0 && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className="text-xs text-muted-foreground h-7"
                    aria-expanded={showQuickReplies}
                    aria-haspopup="true"
                  >
                    <ChevronDown className="h-3 w-3 mr-1" aria-hidden="true" />
                    Quick Replies
                  </Button>
                  {showQuickReplies && (
                    <div className="absolute bottom-full left-0 mb-1 w-72 max-h-48 overflow-y-auto bg-popover border rounded-lg shadow-lg z-10">
                      {quickReplies.map((qr) => (
                        <button
                          key={qr.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0 transition-colors"
                          onClick={() => { setReplyText(qr.body); setShowQuickReplies(false); }}
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

              {/* Composer toolbar */}
              {replyText.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {replyText.length}/{getSegmentLimit(replyText)} &middot; {countSegments(replyText)} segment{countSegments(replyText) !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div className="flex gap-2 items-end">
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
                  rows={1}
                  aria-label="Reply message"
                  className="flex-1 min-h-[36px] max-h-32 resize-none"
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
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add internal note (team only)..."
                  className="flex-1 text-xs h-7"
                  aria-label="Internal note"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddNote(); } }}
                />
                <Button variant="outline" size="sm" onClick={handleAddNote} disabled={!noteText.trim()} className="h-7 text-xs">
                  <StickyNote className="h-3 w-3 mr-1" />
                  Note
                </Button>
              </div>

            </div>
          </>
        )}
      </div>

      {/* Contact Info Sidebar (Right Panel - Desktop) */}
      {selectedId && thread && showSidebar && (
        <div className="hidden md:flex w-72 border-l flex-col shrink-0 overflow-y-auto bg-card">
          <ContactSidebarContent
            contact={contact}
            thread={thread}
            teamMembers={teamMembers}
            responseTagInput={responseTagInput}
            setResponseTagInput={setResponseTagInput}
            contactNoteText={contactNoteText}
            setContactNoteText={setContactNoteText}
            handleAssign={handleAssign}
            handleAddResponseTag={handleAddResponseTag}
            handleRemoveResponseTag={handleRemoveResponseTag}
            handleAddContactNote={handleAddContactNote}
            onContactUpdated={() => selectedId && loadThread(selectedId)}
          />
        </div>
      )}

      {/* Contact Info Sidebar (Mobile Sheet) */}
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side="right" className="p-0 w-80">
          <SheetTitle className="sr-only">Contact Info</SheetTitle>
          {selectedId && thread && (
            <ContactSidebarContent
              contact={contact}
              thread={thread}
              teamMembers={teamMembers}
              responseTagInput={responseTagInput}
              setResponseTagInput={setResponseTagInput}
              contactNoteText={contactNoteText}
              setContactNoteText={setContactNoteText}
              handleAssign={handleAssign}
              handleAddResponseTag={handleAddResponseTag}
              handleRemoveResponseTag={handleRemoveResponseTag}
              handleAddContactNote={handleAddContactNote}
              onContactUpdated={() => selectedId && loadThread(selectedId)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ContactSidebarContent({
  contact,
  thread,
  teamMembers,
  responseTagInput,
  setResponseTagInput,
  contactNoteText,
  setContactNoteText,
  handleAssign,
  handleAddResponseTag,
  handleRemoveResponseTag,
  handleAddContactNote,
  onContactUpdated,
}: any) {
  const [contactTagInput, setContactTagInput] = useState("");
  const [showContactTagInput, setShowContactTagInput] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [optingOut, setOptingOut] = useState(false);

  async function handleAddContactTag() {
    if (!contact?.id || !contactTagInput.trim()) return;
    const tag = contactTagInput.trim().toLowerCase();
    if (contact.tags?.includes(tag)) {
      setContactTagInput("");
      return;
    }
    setAddingTag(true);
    try {
      await bulkAddTagsAction([contact.id], [tag]);
      setContactTagInput("");
      setShowContactTagInput(false);
      toast.success(`Tag "${tag}" added`);
      onContactUpdated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add tag");
    } finally {
      setAddingTag(false);
    }
  }

  async function handleOptOutContact() {
    if (!contact?.id) return;
    setOptingOut(true);
    try {
      await updateContactAction({ id: contact.id, optInStatus: "OPTED_OUT" as any });
      setShowOptOutConfirm(false);
      toast.success("Contact opted out");
      onContactUpdated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to opt out contact");
    } finally {
      setOptingOut(false);
    }
  }

  return (
    <div className="p-4 space-y-5">
      {/* Avatar & Name */}
      <div className="flex flex-col items-center text-center pt-2">
        <Avatar className="h-16 w-16 mb-2">
          <AvatarFallback className="text-lg bg-primary/10 text-primary font-medium">
            {getInitials(contact)}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold">{getContactName(contact)}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{contact?.phone}</p>
        <Badge
          variant={
            contact?.optInStatus === "OPTED_IN" ? "success"
            : contact?.optInStatus === "OPTED_OUT" ? "destructive"
            : "warning"
          }
          className="text-xs mt-2"
        >
          {contact?.optInStatus?.replace("_", " ")}
        </Badge>
        <a href={`/contacts/${contact?.id}`} className="text-xs text-primary hover:underline mt-2">
          View Full Profile
        </a>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Quick Actions</p>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowContactTagInput(!showContactTagInput)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Tag
          </Button>
          {contact?.optInStatus === "OPTED_IN" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => setShowOptOutConfirm(true)}
            >
              <UserX className="h-3 w-3 mr-1" />
              Opt Out
            </Button>
          )}
        </div>
        {showContactTagInput && (
          <div className="flex gap-1 mt-2">
            <Input
              value={contactTagInput}
              onChange={(e) => setContactTagInput(e.target.value)}
              placeholder="Tag name..."
              className="flex-1 text-xs h-7"
              autoFocus
              aria-label="Add contact tag"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddContactTag(); } if (e.key === "Escape") setShowContactTagInput(false); }}
            />
            <Button variant="outline" size="sm" onClick={handleAddContactTag} disabled={!contactTagInput.trim() || addingTag} className="h-7">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
        {showOptOutConfirm && (
          <div className="mt-2 p-2 bg-destructive/5 border border-destructive/20 rounded-lg">
            <p className="text-xs text-destructive font-medium mb-1.5">Opt out this contact?</p>
            <p className="text-[10px] text-muted-foreground mb-2">This will prevent all future messages from being sent to this contact.</p>
            <div className="flex gap-1.5">
              <Button
                variant="destructive"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={handleOptOutContact}
                disabled={optingOut}
              >
                {optingOut ? "Opting out..." : "Confirm Opt Out"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setShowOptOutConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Contact Details */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Details</p>
        {contact?.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate text-xs">{contact.email}</span>
          </div>
        )}
        {contact?.dateOfBirth && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>{new Date(contact.dateOfBirth).toLocaleDateString()}</span>
          </div>
        )}
        {(contact?.city || contact?.state) && (
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>{[contact.city, contact.state].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {contact?.precinct && (
          <div className="flex items-center gap-2 text-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>Precinct: {contact.precinct}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {contact?.tags?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1">
            {contact.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Assignment */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Assigned To</p>
        <NativeSelect
          value={thread?.conversation?.assignedToId || ""}
          onChange={(e) => handleAssign(e.target.value || null)}
          className="text-xs h-8"
          aria-label="Assign conversation to team member"
        >
          <option value="">Unassigned</option>
          {teamMembers.map((member: any) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </NativeSelect>
      </div>

      {/* Response Tags */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Response Tags</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {thread?.conversation?.responseTags?.map((tag: string) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] cursor-pointer hover:bg-destructive/20"
              onClick={() => handleRemoveResponseTag(tag)}
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
            className="flex-1 text-xs h-7"
            aria-label="Add response tag"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddResponseTag(); } }}
          />
          <Button variant="outline" size="sm" onClick={handleAddResponseTag} disabled={!responseTagInput.trim()} className="h-7" aria-label="Add tag">
            <Tag className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {["supportive", "undecided", "opposed", "volunteer", "donor"].map((preset) => (
            <button
              key={preset}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-dashed hover:border-solid transition-colors"
              onClick={() => { setResponseTagInput(preset); handleAddResponseTag(); }}
              aria-label={`Add "${preset}" tag`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Consent */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Consent</p>
        <dl className="space-y-1 text-xs">
          {contact?.optInSource && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Source</dt><dd>{contact.optInSource}</dd></div>
          )}
          {contact?.optInTimestamp && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Opted In</dt><dd>{new Date(contact.optInTimestamp).toLocaleDateString()}</dd></div>
          )}
          {contact?.optOutTimestamp && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Opted Out</dt><dd>{new Date(contact.optOutTimestamp).toLocaleDateString()}</dd></div>
          )}
        </dl>
      </div>

      {/* Contact Notes */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Notes</p>
        <div className="flex gap-1 mb-2">
          <Input
            value={contactNoteText}
            onChange={(e) => setContactNoteText(e.target.value)}
            placeholder="Add a note..."
            className="flex-1 text-xs h-7"
            aria-label="Add contact note"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddContactNote(); } }}
          />
          <Button variant="outline" size="sm" onClick={handleAddContactNote} disabled={!contactNoteText.trim()} className="h-7 text-xs">
            Add
          </Button>
        </div>
        {contact?.contactNotes?.length > 0 ? (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {contact.contactNotes.map((note: any) => (
              <div key={note.id} className="bg-muted/50 rounded-lg p-2 text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium">{note.author?.name}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-muted-foreground">{note.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No notes yet.</p>
        )}
      </div>
    </div>
  );
}
