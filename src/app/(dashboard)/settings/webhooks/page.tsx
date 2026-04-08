"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  listWebhooksAction,
  createWebhookAction,
  deleteWebhookAction,
  toggleWebhookAction,
  getAvailableEvents,
} from "@/server/actions/webhooks";
import {
  Plus,
  Trash2,
  Webhook,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

const ALL_EVENTS = [
  "message.sent",
  "message.delivered",
  "message.failed",
  "message.inbound",
  "contact.opted_in",
  "contact.opted_out",
  "campaign.completed",
  "interest_list.joined",
];

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  failCount: number;
  lastError: string | null;
  createdAt: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [urlError, setUrlError] = useState("");

  // Secret reveal (shown once after creation)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadWebhooks() {
    setLoading(true);
    try {
      const data = await listWebhooksAction();
      setWebhooks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function validateUrl(value: string): boolean {
    if (!value.startsWith("https://")) {
      setUrlError("URL must start with https://");
      return false;
    }
    try {
      new URL(value);
      setUrlError("");
      return true;
    } catch {
      setUrlError("Please enter a valid URL");
      return false;
    }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  }

  function selectAllEvents() {
    setSelectedEvents(
      selectedEvents.length === ALL_EVENTS.length ? [] : [...ALL_EVENTS]
    );
  }

  async function handleCreate() {
    if (!validateUrl(url)) return;
    if (selectedEvents.length === 0) {
      setError("Select at least one event");
      return;
    }
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const result = await createWebhookAction({
        url: url.trim(),
        events: selectedEvents,
      });
      setRevealedSecret(result.secret);
      setCopiedSecret(false);
      setUrl("");
      setSelectedEvents([]);
      setShowCreate(false);
      setSuccess("Webhook endpoint created successfully.");
      await loadWebhooks();
    } catch (err: any) {
      setError(err.message || "Failed to create webhook");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(webhookId: string) {
    setError("");
    try {
      await toggleWebhookAction(webhookId);
      setSuccess("Webhook status updated.");
      await loadWebhooks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(webhookId: string) {
    if (!confirm("Delete this webhook endpoint? This cannot be undone."))
      return;
    setError("");
    try {
      await deleteWebhookAction(webhookId);
      setSuccess("Webhook endpoint deleted.");
      await loadWebhooks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function copySecret() {
    if (!revealedSecret) return;
    navigator.clipboard.writeText(revealedSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  function formatEventLabel(event: string): string {
    return event.replace(/_/g, " ").replace(/\./g, " ");
  }

  function eventCategory(event: string): string {
    return event.split(".")[0];
  }

  function badgeVariantForEvent(
    event: string
  ): "default" | "secondary" | "outline" {
    const cat = eventCategory(event);
    switch (cat) {
      case "message":
        return "default";
      case "contact":
        return "secondary";
      default:
        return "outline";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">
            Receive real-time HTTP callbacks when events occur in your account.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
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

      {/* Secret Reveal Banner */}
      {revealedSecret && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="font-medium text-amber-900">
                  Save your signing secret
                </p>
                <p className="text-sm text-amber-800">
                  This secret is used to verify webhook payloads. It will not be
                  shown again. Copy it now and store it securely.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-amber-200 rounded px-3 py-2 text-sm font-mono break-all">
                    {revealedSecret}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copySecret}
                    className="shrink-0"
                  >
                    {copiedSecret ? (
                      <>
                        <Check className="h-4 w-4 mr-1" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-700"
                  onClick={() => setRevealedSecret(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Add Webhook Endpoint</CardTitle>
            <CardDescription>
              We will send HTTP POST requests to this URL when selected events
              occur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Endpoint URL *</Label>
              <Input
                id="webhookUrl"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (urlError) validateUrl(e.target.value);
                }}
                onBlur={() => url && validateUrl(url)}
                placeholder="https://example.com/webhooks"
                className={urlError ? "border-destructive" : ""}
              />
              {urlError && (
                <p className="text-xs text-destructive">{urlError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be a publicly accessible HTTPS URL.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Events *</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={selectAllEvents}
                >
                  {selectedEvents.length === ALL_EVENTS.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_EVENTS.map((event) => (
                  <label
                    key={event}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{event}</span>
                  </label>
                ))}
              </div>
              {selectedEvents.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Select at least one event to subscribe to.
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setUrl("");
                setSelectedEvents([]);
                setUrlError("");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !url.trim() || selectedEvents.length === 0 || creating
              }
            >
              {creating ? "Creating..." : "Create Webhook"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Webhooks List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : webhooks.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Webhook className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No Webhooks Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Add a webhook endpoint to receive real-time notifications when
              messages are sent, contacts opt in/out, campaigns complete, and
              more.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* URL and status */}
                    <div className="flex items-center gap-3">
                      <code className="text-sm font-mono truncate">
                        {webhook.url}
                      </code>
                      <Badge
                        variant={webhook.isActive ? "success" : "secondary"}
                        className="text-xs shrink-0"
                      >
                        {webhook.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {/* Events */}
                    <div className="flex flex-wrap gap-1.5">
                      {webhook.events.map((event) => (
                        <Badge
                          key={event}
                          variant={badgeVariantForEvent(event)}
                          className="text-xs"
                        >
                          {event}
                        </Badge>
                      ))}
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Created{" "}
                        {new Date(webhook.createdAt).toLocaleDateString()}
                      </span>
                      {webhook.failCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          {webhook.failCount} failed
                          {webhook.failCount === 1
                            ? " delivery"
                            : " deliveries"}
                        </span>
                      )}
                    </div>

                    {/* Last error */}
                    {webhook.lastError && (
                      <div className="rounded bg-destructive/5 border border-destructive/10 px-3 py-2 text-xs text-destructive">
                        Last error: {webhook.lastError}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(webhook.id)}
                      title={
                        webhook.isActive
                          ? "Disable webhook"
                          : "Enable webhook"
                      }
                    >
                      {webhook.isActive ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(webhook.id)}
                      title="Delete webhook"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
