"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  listTemplatesAction,
  createTemplateAction,
  deleteTemplateAction,
} from "@/server/actions/templates";
import { countSegments } from "@/lib/sms-utils";
import { Plus, Search, FileText, Trash2, Copy, MessageSquare } from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "gotv", label: "GOTV" },
  { value: "fundraising", label: "Fundraising" },
  { value: "event", label: "Event" },
  { value: "survey", label: "Survey" },
  { value: "follow-up", label: "Follow-up" },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Create form
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [category, search]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await listTemplatesAction({
        category: category !== "all" ? category : undefined,
        search: search || undefined,
      });
      setTemplates(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!name.trim() || !body.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createTemplateAction({
        name: name.trim(),
        body: body.trim(),
        category: newCategory,
      });
      setName("");
      setBody("");
      setShowCreate(false);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || "Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteTemplateAction(id);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Message Templates</h1>
          <p className="text-muted-foreground">
            Reusable message scripts for campaigns and quick replies.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="pl-9"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., GOTV Reminder"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  {CATEGORIES.filter((c) => c.value !== "all").map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message Body *</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hi {{firstName}}, this is a reminder that..."
                rows={4}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{body.length} characters</span>
                <span>{countSegments(body)} segment{countSegments(body) !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground mr-1">Merge fields:</span>
              {["{{firstName}}", "{{lastName}}", "{{fullName}}", "{{orgName}}", "{{precinct}}"].map(
                (f) => (
                  <button
                    key={f}
                    className="text-xs border rounded px-1.5 py-0.5 hover:bg-muted"
                    onClick={() => setBody((p) => p + f)}
                  >
                    {f}
                  </button>
                )
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || !body.trim() || creating}>
              {creating ? "Creating..." : "Create Template"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No Templates Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Create reusable message scripts for your campaigns. Templates save time and
              keep your messaging consistent across your team.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {template.category}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  by {template.createdBy?.name} &middot; Used {template.usageCount} times
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.body}
                </p>
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>
                    {template.body.length} chars &middot;{" "}
                    {countSegments(template.body)} segment{countSegments(template.body) !== 1 ? "s" : ""}
                  </span>
                  <span>{template.language?.toUpperCase()}</span>
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-1 pt-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(template.body)}
                  title="Copy message text"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(template.id)}
                  title="Delete template"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
