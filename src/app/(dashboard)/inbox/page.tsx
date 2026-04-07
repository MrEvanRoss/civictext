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
} from "@/server/actions/inbox";
import { Inbox, Send, StickyNote, User } from "lucide-react";

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unassigned" | "mine">("all");
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [filter]);

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
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    try {
      await sendReplyAction(selectedId, replyText.trim());
      setReplyText("");
      await loadThread(selectedId);
      await loadConversations();
    } catch (err: any) {
      alert(err.message || "Failed to send reply");
    } finally {
      setSending(false);
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

  return (
    <div className="flex h-[calc(100vh-4rem)] -mt-6 -mx-6">
      {/* Thread List (Left Panel) */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b space-y-2">
          <h2 className="font-semibold">Inbox</h2>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-sm"
          >
            <option value="all">All Conversations</option>
            <option value="mine">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
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

      {/* Message Thread (Right Panel) */}
      <div className="flex-1 flex flex-col">
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
                    {thread.conversation.contact?.firstName
                      ? `${thread.conversation.contact.firstName} ${thread.conversation.contact.lastName || ""}`.trim()
                      : thread.conversation.contact?.phone}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {thread.conversation.contact?.phone}
                  </p>
                </div>
              </div>
              {thread.conversation.contact?.tags?.length > 0 && (
                <div className="flex gap-1">
                  {thread.conversation.contact.tags.slice(0, 3).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

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
              <div className="flex gap-2">
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
                  disabled={!replyText.trim() || sending}
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
    </div>
  );
}
