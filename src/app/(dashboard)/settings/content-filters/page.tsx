"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listContentFiltersAction,
  createContentFilterAction,
  deleteContentFilterAction,
  toggleContentFilterAction,
  bulkImportContentFiltersAction,
} from "@/server/actions/content-filters";
import { Plus, Trash2, Filter, Upload } from "lucide-react";

type ContentFilterAction = "HIDE" | "FLAG" | "AUTO_REPLY" | "BLOCK";

interface ContentFilter {
  id: string;
  phrase: string;
  action: ContentFilterAction;
  isActive: boolean;
  createdAt: string;
}

const ACTION_LABELS: Record<ContentFilterAction, string> = {
  HIDE: "Hide from inbox",
  FLAG: "Flag for review",
  AUTO_REPLY: "Auto-reply",
  BLOCK: "Block sender",
};

const ACTION_BADGE_STYLES: Record<ContentFilterAction, string> = {
  HIDE: "bg-gray-100 text-gray-700 border-gray-200",
  FLAG: "bg-yellow-50 text-yellow-700 border-yellow-200",
  AUTO_REPLY: "bg-blue-50 text-blue-700 border-blue-200",
  BLOCK: "bg-red-50 text-red-700 border-red-200",
};

export default function ContentFiltersPage() {
  const [filters, setFilters] = useState<ContentFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Add filter form
  const [phrase, setPhrase] = useState("");
  const [action, setAction] = useState<ContentFilterAction>("HIDE");
  const [creating, setCreating] = useState(false);

  // Bulk import
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkPhrases, setBulkPhrases] = useState("");
  const [bulkAction, setBulkAction] = useState<ContentFilterAction>("HIDE");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadFilters();
  }, []);

  async function loadFilters() {
    setLoading(true);
    try {
      const data = await listContentFiltersAction();
      setFilters(data as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setError("");
    setSuccess("");
    if (!phrase.trim()) return;
    setCreating(true);
    try {
      await createContentFilterAction(phrase.trim(), action);
      setSuccess("Filter created.");
      setPhrase("");
      setAction("HIDE");
      await loadFilters();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(id: string) {
    setError("");
    setSuccess("");
    try {
      await toggleContentFilterAction(id);
      setSuccess("Filter updated.");
      await loadFilters();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this content filter?")) return;
    setError("");
    setSuccess("");
    try {
      await deleteContentFilterAction(id);
      setSuccess("Filter deleted.");
      await loadFilters();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleBulkImport() {
    setError("");
    setSuccess("");
    const phrases = bulkPhrases
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    if (phrases.length === 0) {
      setError("Enter at least one phrase to import.");
      return;
    }
    setImporting(true);
    try {
      const result = await bulkImportContentFiltersAction(phrases, bulkAction);
      setSuccess(
        `Imported ${result.created} filter${result.created !== 1 ? "s" : ""}` +
          (result.skipped > 0 ? ` (${result.skipped} already existed)` : "") +
          "."
      );
      setBulkPhrases("");
      setShowBulkImport(false);
      await loadFilters();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Filters</h1>
          <p className="text-muted-foreground">
            Filter offensive or unwanted content from inbound messages.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowBulkImport(!showBulkImport)}
        >
          <Upload className="h-4 w-4 mr-2" />
          Bulk Import
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

      {/* Add Filter Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Filter</CardTitle>
          <CardDescription>
            Add a phrase to filter from inbound messages. Matching is
            case-insensitive.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="phrase">Phrase</Label>
              <Input
                id="phrase"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="e.g., offensive word or phrase"
              />
            </div>
            <div className="w-48 space-y-2">
              <Label>Action</Label>
              <Select
                value={action}
                onValueChange={(v) => setAction(v as ContentFilterAction)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIDE">Hide from inbox</SelectItem>
                  <SelectItem value="FLAG">Flag for review</SelectItem>
                  <SelectItem value="AUTO_REPLY">Auto-reply</SelectItem>
                  <SelectItem value="BLOCK">Block sender</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating || !phrase.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              {creating ? "Adding..." : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Import */}
      {showBulkImport && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Import</CardTitle>
            <CardDescription>
              Paste multiple phrases below, one per line. Duplicates will be
              skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulkPhrases">Phrases (one per line)</Label>
              <Textarea
                id="bulkPhrases"
                value={bulkPhrases}
                onChange={(e) => setBulkPhrases(e.target.value)}
                placeholder={"bad word\noffensive phrase\nunwanted term"}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                {bulkPhrases.split("\n").filter((l) => l.trim()).length} phrases
              </p>
            </div>
            <div className="w-48 space-y-2">
              <Label>Action for all</Label>
              <Select
                value={bulkAction}
                onValueChange={(v) => setBulkAction(v as ContentFilterAction)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIDE">Hide from inbox</SelectItem>
                  <SelectItem value="FLAG">Flag for review</SelectItem>
                  <SelectItem value="AUTO_REPLY">Auto-reply</SelectItem>
                  <SelectItem value="BLOCK">Block sender</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkImport(false);
                setBulkPhrases("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={
                importing || !bulkPhrases.split("\n").some((l) => l.trim())
              }
            >
              <Upload className="h-4 w-4 mr-2" />
              {importing ? "Importing..." : "Import"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Filters Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : filters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Filter className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No Content Filters</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Add phrases above to automatically filter offensive or unwanted
              content from inbound messages.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                      Phrase
                    </th>
                    <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                      Action
                    </th>
                    <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">
                      Active
                    </th>
                    <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                      Delete
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filters.map((filter) => (
                    <tr
                      key={filter.id}
                      className={`border-b last:border-0 ${
                        !filter.isActive ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sm">
                        {filter.phrase}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={ACTION_BADGE_STYLES[filter.action]}
                        >
                          {ACTION_LABELS[filter.action]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Switch
                          checked={filter.isActive}
                          onCheckedChange={() => handleToggle(filter.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(filter.id)}
                          title="Delete filter"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
