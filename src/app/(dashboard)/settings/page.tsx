"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save, Webhook, KeyRound, MessageSquareReply, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    orgName: "",
    timezone: "America/New_York",
    quietHoursStart: "21:00",
    quietHoursEnd: "08:00",
    politicalDisclaimer: "",
  });

  function validateForm() {
    const newErrors: Record<string, string> = {};
    if (!form.orgName.trim()) {
      newErrors.orgName = "Organization name is required";
    }
    if (!form.timezone.trim()) {
      newErrors.timezone = "Timezone is required";
    }
    if (!form.quietHoursStart) {
      newErrors.quietHoursStart = "Quiet hours start time is required";
    }
    if (!form.quietHoursEnd) {
      newErrors.quietHoursEnd = "Quiet hours end time is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) {
      toast.error("Please fix the validation errors before saving.");
      return;
    }
    setSaving(true);
    try {
      // TODO: wire up saveSettingsAction when available
      await new Promise((r) => setTimeout(r, 500));
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-36 mb-1" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            General organization settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={form.orgName}
              onChange={(e) => {
                setForm((p) => ({ ...p, orgName: e.target.value }));
                if (errors.orgName) setErrors((prev) => ({ ...prev, orgName: "" }));
              }}
              className={errors.orgName ? "border-destructive" : ""}
            />
            {errors.orgName && (
              <p className="text-sm text-destructive">{errors.orgName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Default Timezone</Label>
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(e) => {
                setForm((p) => ({ ...p, timezone: e.target.value }));
                if (errors.timezone) setErrors((prev) => ({ ...prev, timezone: "" }));
              }}
              placeholder="America/New_York"
              className={errors.timezone ? "border-destructive" : ""}
            />
            {errors.timezone && (
              <p className="text-sm text-destructive">{errors.timezone}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>
            Messages will not be sent during quiet hours (TCPA compliance).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quietStart">Quiet Hours Start</Label>
              <Input
                id="quietStart"
                type="time"
                value={form.quietHoursStart}
                onChange={(e) => {
                  setForm((p) => ({ ...p, quietHoursStart: e.target.value }));
                  if (errors.quietHoursStart) setErrors((prev) => ({ ...prev, quietHoursStart: "" }));
                }}
                className={errors.quietHoursStart ? "border-destructive" : ""}
              />
              {errors.quietHoursStart && (
                <p className="text-sm text-destructive">{errors.quietHoursStart}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quietEnd">Quiet Hours End</Label>
              <Input
                id="quietEnd"
                type="time"
                value={form.quietHoursEnd}
                onChange={(e) => {
                  setForm((p) => ({ ...p, quietHoursEnd: e.target.value }));
                  if (errors.quietHoursEnd) setErrors((prev) => ({ ...prev, quietHoursEnd: "" }));
                }}
                className={errors.quietHoursEnd ? "border-destructive" : ""}
              />
              {errors.quietHoursEnd && (
                <p className="text-sm text-destructive">{errors.quietHoursEnd}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Default: 9PM - 8AM. Messages hitting quiet hours are automatically
            delayed to the next send window.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Political Disclaimer</CardTitle>
          <CardDescription>
            Required for political campaigns. Auto-appended to all outbound messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disclaimer">Disclaimer Text</Label>
            <Textarea
              id="disclaimer"
              value={form.politicalDisclaimer}
              onChange={(e) =>
                setForm((p) => ({ ...p, politicalDisclaimer: e.target.value }))
              }
              placeholder="Paid for by Citizens for Progress"
              rows={2}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty if not a political organization. FEC requires &quot;Paid
            for by&quot; disclosures on political communications.
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button disabled={saving} onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Security</CardTitle>
          <CardDescription>
            Protect your account with additional security measures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link
            href="/settings/security"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">
                Add an extra layer of security with an authenticator app (TOTP).
              </p>
            </div>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Connect CivicText with external services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link
            href="/settings/webhooks"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <Webhook className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Webhooks</p>
              <p className="text-xs text-muted-foreground">
                Send real-time events to your servers when messages are sent, delivered, or contacts opt in/out.
              </p>
            </div>
          </Link>
          <Link
            href="/settings/api-keys"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">API Keys</p>
              <p className="text-xs text-muted-foreground">
                Manage API keys for programmatic access to CivicText.
              </p>
            </div>
          </Link>
          <Link
            href="/settings/auto-reply"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <MessageSquareReply className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Auto-Reply Rules</p>
              <p className="text-xs text-muted-foreground">
                Automatically respond to inbound messages matching specific keywords.
              </p>
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
