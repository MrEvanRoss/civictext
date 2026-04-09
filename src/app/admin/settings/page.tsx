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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  DollarSign,
  Shield,
  Bell,
  Globe,
  Save,
  RefreshCw,
  Mail,
  Phone,
  Clock,
  ShieldCheck,
} from "lucide-react";
import {
  getAdminSettingsAction,
  updateAdminSettingsAction,
} from "@/server/actions/admin-settings";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    // Default pricing
    defaultSmsRateCents: 4,
    defaultMmsRateCents: 8,
    defaultPhoneNumberFeeCents: 500,
    minimumCreditsDollars: 5,

    // Compliance
    maxOptOutRatePercent: 5,
    maxFailureRatePercent: 10,
    autoSuspendOnHighOptOut: false,
    enforceQuietHours: true,
    defaultQuietHoursStart: "21:00",
    defaultQuietHoursEnd: "08:00",

    // Notifications
    adminNotificationEmail: "",
    alertOnNewOrg: true,
    alertOnHighOptOut: true,
    alertOnPaymentFailure: true,

    // Platform
    platformName: "CivicText",
    supportEmail: "",
    supportPhone: "",
    maintenanceMode: false,

    // Two-Factor Authentication
    require2FAForOwners: false,
    require2FAForAdmins: false,
    require2FAForManagers: false,
    require2FAForSenders: false,
    require2FAForViewers: false,
    require2FAGracePeriodDays: 7,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await getAdminSettingsAction();
      if (data) {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateAdminSettingsAction(settings);
      toast.success("Settings saved successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground">
            Configure default rates, compliance rules, and platform behavior.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSettings}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Reload
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Default Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Default Pricing
            </CardTitle>
            <CardDescription>
              Default rates applied to new organizations. Can be overridden per-org.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>SMS Rate (cents per segment)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={settings.defaultSmsRateCents}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, defaultSmsRateCents: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>MMS Rate (cents per message)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={settings.defaultMmsRateCents}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, defaultMmsRateCents: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number Fee (cents per month)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={settings.defaultPhoneNumberFeeCents}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, defaultPhoneNumberFeeCents: parseInt(e.target.value) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Currently: ${(settings.defaultPhoneNumberFeeCents / 100).toFixed(2)}/mo
              </p>
            </div>
            <div className="space-y-2">
              <Label>Minimum Credits Purchase ($)</Label>
              <Input
                type="number"
                step="1"
                min="1"
                value={settings.minimumCreditsDollars}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, minimumCreditsDollars: parseInt(e.target.value) || 5 }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Compliance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Compliance
            </CardTitle>
            <CardDescription>
              Rules that govern messaging behavior and automated enforcement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Max Opt-Out Rate Threshold (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={settings.maxOptOutRatePercent}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, maxOptOutRatePercent: parseFloat(e.target.value) || 5 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Campaigns exceeding this rate appear on the compliance dashboard.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Max Failure Rate Threshold (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={settings.maxFailureRatePercent}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, maxFailureRatePercent: parseFloat(e.target.value) || 10 }))
                }
              />
            </div>
            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={settings.autoSuspendOnHighOptOut}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, autoSuspendOnHighOptOut: e.target.checked }))
                }
                className="h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-medium">Auto-set inactive on high opt-out</p>
                <p className="text-xs text-muted-foreground">
                  Automatically set orgs to inactive if campaigns exceed opt-out threshold.
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={settings.enforceQuietHours}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, enforceQuietHours: e.target.checked }))
                }
                className="h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-medium">Enforce quiet hours (TCPA)</p>
                <p className="text-xs text-muted-foreground">
                  Block messages outside of allowed hours (recipient local time).
                </p>
              </div>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Default Quiet Start
                </Label>
                <Input
                  type="time"
                  value={settings.defaultQuietHoursStart}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, defaultQuietHoursStart: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Default Quiet End
                </Label>
                <Input
                  type="time"
                  value={settings.defaultQuietHoursEnd}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, defaultQuietHoursEnd: e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Require 2FA for specific roles. Users without 2FA enabled will be prompted to set it up on their next login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Require 2FA for Roles</p>
              {[
                { key: "require2FAForOwners" as const, label: "Owners", desc: "Full account control" },
                { key: "require2FAForAdmins" as const, label: "Admins", desc: "Org management access" },
                { key: "require2FAForManagers" as const, label: "Managers", desc: "Campaign and team oversight" },
                { key: "require2FAForSenders" as const, label: "Senders", desc: "Message sending access" },
                { key: "require2FAForViewers" as const, label: "Viewers", desc: "Read-only access" },
              ].map((role) => (
                <label key={role.key} className="flex items-center gap-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={settings[role.key]}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, [role.key]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">{role.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{role.desc}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="border-t pt-4 space-y-2">
              <Label>Grace Period (days)</Label>
              <Input
                type="number"
                min="0"
                max="90"
                value={settings.require2FAGracePeriodDays}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, require2FAGracePeriodDays: parseInt(e.target.value) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Number of days users have to enable 2FA after the requirement is turned on. Set to 0 to enforce immediately.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure admin alert preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Admin Notification Email
              </Label>
              <Input
                type="email"
                value={settings.adminNotificationEmail}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, adminNotificationEmail: e.target.value }))
                }
                placeholder="admin@civictext.org"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Alert Triggers</p>
              <label className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  checked={settings.alertOnNewOrg}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, alertOnNewOrg: e.target.checked }))
                  }
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">New organization signup</span>
              </label>
              <label className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  checked={settings.alertOnHighOptOut}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, alertOnHighOptOut: e.target.checked }))
                  }
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">High opt-out rate detected</span>
              </label>
              <label className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  checked={settings.alertOnPaymentFailure}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, alertOnPaymentFailure: e.target.checked }))
                  }
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">Payment failure</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Platform */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Platform
            </CardTitle>
            <CardDescription>
              General platform configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Platform Name</Label>
              <Input
                value={settings.platformName}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, platformName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Support Email
              </Label>
              <Input
                type="email"
                value={settings.supportEmail}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, supportEmail: e.target.value }))
                }
                placeholder="support@civictext.org"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Support Phone
              </Label>
              <Input
                type="tel"
                value={settings.supportPhone}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, supportPhone: e.target.value }))
                }
                placeholder="(555) 123-4567"
              />
            </div>
            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, maintenanceMode: e.target.checked }))
                }
                className="h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-medium">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">
                  When enabled, client dashboards show a maintenance notice. Admin panel remains accessible.
                </p>
              </div>
            </label>
            {settings.maintenanceMode && (
              <Badge variant="warning" className="text-xs">
                Maintenance mode is currently active
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
