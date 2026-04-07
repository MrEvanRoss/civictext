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
import {
  getContactAction,
  updateContactAction,
  deleteContactAction,
} from "@/server/actions/contacts";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    tags: "",
    optInStatus: "",
  });

  useEffect(() => {
    loadContact();
  }, [contactId]);

  async function loadContact() {
    try {
      const data = await getContactAction(contactId);
      if (!data) {
        router.push("/contacts");
        return;
      }
      setContact(data);
      setForm({
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        email: data.email || "",
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
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>
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
    </div>
  );
}
