"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createContactAction } from "@/server/actions/contacts";
import { ArrowLeft } from "lucide-react";

export default function NewContactPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    phone: "",
    firstName: "",
    lastName: "",
    email: "",
    tags: "",
    optInStatus: "OPTED_IN" as "OPTED_IN" | "PENDING",
    optInSource: "manual",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const contact = await createContactAction({
        phone: form.phone,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        customFields: {},
        optInStatus: form.optInStatus,
        optInSource: form.optInSource,
      });
      router.push(`/contacts/${contact.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Add Contact</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>
              Add a new contact manually. Phone number is required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+15551234567"
                required
              />
            </div>
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
                onChange={(e) =>
                  setForm((p) => ({ ...p, optInStatus: e.target.value as any }))
                }
              >
                <option value="OPTED_IN">Opted In</option>
                <option value="PENDING">Pending</option>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={saving || !form.phone}>
              {saving ? "Creating..." : "Create Contact"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
