"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    orgName: "",
    timezone: "America/New_York",
    quietHoursStart: "21:00",
    quietHoursEnd: "08:00",
    politicalDisclaimer: "",
  });

  return (
    <div className="space-y-6">
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
              onChange={(e) => setForm((p) => ({ ...p, orgName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Default Timezone</Label>
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              placeholder="America/New_York"
            />
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quietStart">Quiet Hours Start</Label>
              <Input
                id="quietStart"
                type="time"
                value={form.quietHoursStart}
                onChange={(e) =>
                  setForm((p) => ({ ...p, quietHoursStart: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quietEnd">Quiet Hours End</Label>
              <Input
                id="quietEnd"
                type="time"
                value={form.quietHoursEnd}
                onChange={(e) =>
                  setForm((p) => ({ ...p, quietHoursEnd: e.target.value }))
                }
              />
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
          <Button disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
