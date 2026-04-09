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
import {
  listAutoReplyRulesAction,
  createAutoReplyRuleAction,
  updateAutoReplyRuleAction,
  deleteAutoReplyRuleAction,
} from "@/server/actions/auto-reply";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, MessageSquareReply, X, Power, PowerOff } from "lucide-react";

interface AutoReplyRule {
  id: string;
  name: string;
  keywords: string[];
  replyBody: string;
  mediaUrl: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export default function AutoReplyPage() {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [priority, setPriority] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setLoading(true);
    try {
      const data = await listAutoReplyRulesAction();
      setRules(data as any);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function addKeyword() {
    const kw = keywordInput.toUpperCase().trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
    }
    setKeywordInput("");
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw));
  }

  async function handleCreate() {
    setError("");
    setSuccess("");
    setCreating(true);
    try {
      await createAutoReplyRuleAction({
        name: name.trim(),
        keywords,
        replyBody: replyBody.trim(),
        priority,
      });
      setSuccess("Auto-reply rule created.");
      setName("");
      setKeywords([]);
      setKeywordInput("");
      setReplyBody("");
      setPriority(0);
      setShowCreate(false);
      await loadRules();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(ruleId: string, currentActive: boolean) {
    try {
      await updateAutoReplyRuleAction(ruleId, { isActive: !currentActive });
      setSuccess(`Rule ${currentActive ? "disabled" : "enabled"}.`);
      await loadRules();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }

  function handleDelete(ruleId: string) {
    setPendingDeleteId(ruleId);
    setShowDeleteDialog(true);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    setShowDeleteDialog(false);
    try {
      await deleteAutoReplyRuleAction(pendingDeleteId);
      setSuccess("Rule deleted.");
      await loadRules();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auto-Reply Rules</h1>
          <p className="text-muted-foreground">
            Automatically respond to inbound messages matching specific keywords.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-success/10 border border-success/30 p-4 text-sm text-success">
          {success}
        </div>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Auto-Reply Rule</CardTitle>
            <CardDescription>
              When a contact texts one of these keywords, they will automatically receive your reply.
              Keywords are checked after opt-in/opt-out and Interest List keywords.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ruleName">Rule Name *</Label>
              <Input
                id="ruleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Hours of Operation"
              />
            </div>

            <div className="space-y-2">
              <Label>Keywords *</Label>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="Type a keyword and press Enter"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addKeyword} disabled={!keywordInput.trim()}>
                  Add
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="gap-1">
                      {kw}
                      <button type="button" onClick={() => removeKeyword(kw)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Keywords are case-insensitive. Reserved words (STOP, START, YES, etc.) cannot be used.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="replyBody">Reply Message *</Label>
              <Textarea
                id="replyBody"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="The message that will be sent back automatically..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {replyBody.length} characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                min={0}
                max={100}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Higher priority rules match first when a keyword matches multiple rules.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowCreate(false); setName(""); setKeywords([]); setReplyBody(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim() || keywords.length === 0 || !replyBody.trim()}
            >
              {creating ? "Creating..." : "Create Rule"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : rules.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <MessageSquareReply className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No Auto-Reply Rules</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Create rules to automatically respond when contacts text specific keywords like INFO, HOURS, or HELP.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Your First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={!rule.isActive ? "opacity-60" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                        {rule.isActive ? "Active" : "Disabled"}
                      </Badge>
                      {rule.priority > 0 && (
                        <span className="text-xs text-muted-foreground">Priority: {rule.priority}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {rule.keywords.map((kw) => (
                        <Badge key={kw} variant="outline" className="text-xs font-mono">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{rule.replyBody}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(rule.id, rule.isActive)}
                      title={rule.isActive ? "Disable" : "Enable"}
                    >
                      {rule.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete auto-reply rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this auto-reply rule?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
