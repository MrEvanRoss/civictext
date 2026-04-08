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
  listApiKeysAction,
  createApiKeyAction,
  revokeApiKeyAction,
  deleteApiKeyAction,
} from "@/server/actions/api-keys";
import {
  Plus,
  Trash2,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  ShieldOff,
} from "lucide-react";

const ALL_PERMISSIONS = [
  { value: "contacts:read", label: "Contacts (Read)" },
  { value: "contacts:write", label: "Contacts (Write)" },
  { value: "messages:send", label: "Messages (Send)" },
  { value: "messages:read", label: "Messages (Read)" },
  { value: "campaigns:read", label: "Campaigns (Read)" },
  { value: "campaigns:write", label: "Campaigns (Write)" },
  { value: "lists:read", label: "Interest Lists (Read)" },
  { value: "lists:write", label: "Interest Lists (Write)" },
];

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: { name: string } | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    setLoading(true);
    try {
      const data = await listApiKeysAction();
      setKeys(data as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function togglePerm(perm: string) {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (selectedPerms.length === 0) { setError("Select at least one permission"); return; }
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const result = await createApiKeyAction({
        name: name.trim(),
        permissions: selectedPerms,
      });
      setRevealedKey(result.key);
      setCopiedKey(false);
      setName("");
      setSelectedPerms([]);
      setShowCreate(false);
      setSuccess("API key created. Copy it now — it won't be shown again.");
      await loadKeys();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Revoke this API key? It will immediately stop working.")) return;
    try {
      await revokeApiKeyAction(keyId);
      setSuccess("API key revoked.");
      await loadKeys();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(keyId: string) {
    if (!confirm("Permanently delete this API key?")) return;
    try {
      await deleteApiKeyAction(keyId);
      setSuccess("API key deleted.");
      await loadKeys();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function copyKey() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for programmatic access to CivicText.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          {success}
        </div>
      )}

      {revealedKey && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="font-medium text-amber-900">Save your API key</p>
                <p className="text-sm text-amber-800">
                  This key will not be shown again. Copy it now and store it securely.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-amber-200 rounded px-3 py-2 text-sm font-mono break-all">
                    {revealedKey}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyKey} className="shrink-0">
                    {copiedKey ? (
                      <><Check className="h-4 w-4 mr-1" /> Copied</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copy</>
                    )}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="text-amber-700" onClick={() => setRevealedKey(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create API Key</CardTitle>
            <CardDescription>API keys provide programmatic access to your CivicText data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Key Name *</Label>
              <Input
                id="keyName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Production Integration"
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.value}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(perm.value)}
                      onChange={() => togglePerm(perm.value)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowCreate(false); setName(""); setSelectedPerms([]); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim() || selectedPerms.length === 0}>
              {creating ? "Creating..." : "Create Key"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : keys.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <KeyRound className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No API Keys</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Create an API key to integrate CivicText with your other tools and services.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Your First API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <Card key={key.id} className={!key.isActive ? "opacity-60" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{key.name}</span>
                      <Badge variant={key.isActive ? "default" : "secondary"} className="text-xs">
                        {key.isActive ? "Active" : "Revoked"}
                      </Badge>
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">
                      {key.keyPrefix}...
                    </code>
                    <div className="flex flex-wrap gap-1">
                      {key.permissions.map((perm) => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.createdBy && <span>by {key.createdBy.name}</span>}
                      {key.lastUsedAt && (
                        <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                      )}
                      {key.expiresAt && (
                        <span className={new Date(key.expiresAt) < new Date() ? "text-destructive" : ""}>
                          Expires {new Date(key.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {key.isActive && (
                      <Button variant="outline" size="sm" onClick={() => handleRevoke(key.id)} title="Revoke key">
                        <ShieldOff className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(key.id)} title="Delete key">
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
