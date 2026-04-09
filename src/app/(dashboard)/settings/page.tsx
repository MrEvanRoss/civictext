"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import {
  Save,
  Webhook,
  KeyRound,
  ShieldCheck,
  CreditCard,
  Users,
  MessageSquare,
  Paintbrush,
  Plug,
  Settings2,
  Smartphone,
  Sun,
  Moon,
  Monitor,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Upload,
  Trash2,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  getOrgSettingsAction,
  updateOrgSettingsAction,
  updateOrgLogoAction,
} from "@/server/actions/org-settings";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "America/Phoenix", label: "Arizona (MST, no DST)" },
] as const;

const ACCENT_COLORS = [
  { value: "#2563eb", label: "Blue" },
  { value: "#7c3aed", label: "Purple" },
  { value: "#059669", label: "Green" },
  { value: "#dc2626", label: "Red" },
  { value: "#ea580c", label: "Orange" },
  { value: "#d97706", label: "Amber" },
  { value: "#0891b2", label: "Cyan" },
  { value: "#db2777", label: "Pink" },
] as const;

const TAB_ITEMS = [
  { key: "general", label: "General", icon: Settings2 },
  { key: "signup", label: "Signup Messages", icon: MessageSquare },
  { key: "team", label: "Team", icon: Users },
  { key: "customize", label: "Customize", icon: Paintbrush },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "appearance", label: "Appearance", icon: Sun },
] as const;

type TabKey = (typeof TAB_ITEMS)[number]["key"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgData {
  name: string;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  politicalDisclaimer: string | null;
  welcomeMessage: string | null;
  optOutMessage: string | null;
  messageSignature: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  phoneNumber: string | null;
  twilioAccountSid: string | null;
  userName: string;
  userEmail: string;
}

// ---------------------------------------------------------------------------
// Root page (wrapped in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          {/* Tab bar */}
          <div className="border-b overflow-x-auto">
            <nav className="-mb-px flex gap-1 min-w-max">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="inline-flex items-center gap-1.5 px-3 py-2.5">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-16 hidden sm:block" />
                </div>
              ))}
            </nav>
          </div>
          {/* Tab content cards */}
          <div className="min-h-[400px]">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className={i > 0 ? "mt-6" : ""}>
                <CardHeader>
                  <Skeleton className="h-6 w-36 mb-1" />
                  <Skeleton className="h-4 w-56" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Main Content
// ---------------------------------------------------------------------------

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabKey) || "general";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgData, setOrgData] = useState<OrgData | null>(null);

  // Form state mirrors orgData but is user-editable
  const [form, setForm] = useState({
    name: "",
    timezone: "America/New_York",
    quietHoursStart: "21:00",
    quietHoursEnd: "08:00",
    politicalDisclaimer: "",
    welcomeMessage: "",
    optOutMessage: "",
    messageSignature: "",
    accentColor: "",
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrgSettingsAction();
      setOrgData(data);
      setForm({
        name: data.name ?? "",
        timezone: data.timezone ?? "America/New_York",
        quietHoursStart: data.quietHoursStart ?? "21:00",
        quietHoursEnd: data.quietHoursEnd ?? "08:00",
        politicalDisclaimer: data.politicalDisclaimer ?? "",
        welcomeMessage: data.welcomeMessage ?? "",
        optOutMessage: data.optOutMessage ?? "",
        messageSignature: data.messageSignature ?? "",
        accentColor: data.accentColor ?? "",
      });
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function setTab(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "general") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.push(`/settings?${params.toString()}`, { scroll: false });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Organization name is required");
      return;
    }
    setSaving(true);
    try {
      await updateOrgSettingsAction({
        name: form.name,
        timezone: form.timezone,
        quietHoursStart: form.quietHoursStart,
        quietHoursEnd: form.quietHoursEnd,
        politicalDisclaimer: form.politicalDisclaimer || null,
        welcomeMessage: form.welcomeMessage || null,
        optOutMessage: form.optOutMessage || null,
        messageSignature: form.messageSignature || null,
        accentColor: form.accentColor || null,
      });
      toast.success("Settings saved");
      // Refresh orgData so read-only fields stay in sync
      await loadSettings();
      // Notify sidebar to re-fetch branding (name may have changed)
      window.dispatchEvent(new Event("org-branding-update"));
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-36 mb-1" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and preferences.
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b overflow-x-auto">
        <nav className="-mb-px flex gap-1 min-w-max" aria-label="Settings tabs">
          {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium
                border-b-2 transition-colors whitespace-nowrap
                ${
                  activeTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === "general" && (
          <GeneralTab
            form={form}
            setForm={setForm}
            orgData={orgData}
            saving={saving}
            onSave={handleSave}
            onLogoChange={() => {
              loadSettings();
              // Notify sidebar to re-fetch branding
              window.dispatchEvent(new Event("org-branding-update"));
            }}
          />
        )}
        {activeTab === "signup" && (
          <SignupMessagesTab
            form={form}
            setForm={setForm}
            orgData={orgData}
            saving={saving}
            onSave={handleSave}
          />
        )}
        {activeTab === "team" && <TeamTab />}
        {activeTab === "customize" && (
          <CustomizeTab
            form={form}
            setForm={setForm}
            saving={saving}
            onSave={handleSave}
          />
        )}
        {activeTab === "billing" && <BillingTab />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "integrations" && (
          <IntegrationsTab orgData={orgData} />
        )}
        {activeTab === "appearance" && (
          <AppearanceTab
            form={form}
            setForm={setForm}
            saving={saving}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// GENERAL TAB
// ===========================================================================

function GeneralTab({
  form,
  setForm,
  orgData,
  saving,
  onSave,
  onLogoChange,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  orgData: OrgData | null;
  saving: boolean;
  onSave: () => void;
  onLogoChange: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }

      await updateOrgLogoAction(data.url);
      toast.success("Logo updated");
      onLogoChange();
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected
      e.target.value = "";
    }
  }

  async function handleRemoveLogo() {
    setRemovingLogo(true);
    try {
      await updateOrgLogoAction(null);
      toast.success("Logo removed");
      onLogoChange();
    } catch {
      toast.error("Failed to remove logo");
    } finally {
      setRemovingLogo(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Organization Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Logo</CardTitle>
          <CardDescription>
            Your logo appears in the sidebar navigation. Recommended: square image, at least 200x200px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Logo preview */}
            <div className="shrink-0">
              {orgData?.logoUrl ? (
                <div className="relative h-20 w-20 rounded-xl border-2 border-border overflow-hidden bg-muted">
                  <Image
                    src={orgData.logoUrl}
                    alt="Organization logo"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Upload / Remove buttons */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  asChild
                >
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-1.5" />
                    {uploading ? "Uploading..." : orgData?.logoUrl ? "Change Logo" : "Upload Logo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleLogoUpload}
                      className="sr-only"
                    />
                  </label>
                </Button>
                {orgData?.logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removingLogo}
                    onClick={handleRemoveLogo}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    {removingLogo ? "Removing..." : "Remove"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, or WebP. Max 2MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            General information about your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={form.name}
              onChange={(e) =>
                setForm((p: any) => ({ ...p, name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={orgData?.phoneNumber ?? "No active phone number"}
              readOnly
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Managed in Phone Numbers. This is your primary sending number.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Info</CardTitle>
          <CardDescription>
            Your account details (managed via your profile).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={orgData?.userName ?? ""} readOnly disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={orgData?.userEmail ?? ""} readOnly disabled className="bg-muted" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button disabled={saving} onClick={onSave}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ===========================================================================
// SIGNUP MESSAGES TAB
// ===========================================================================

const SETTINGS_URL_REGEX = /(?:https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:com|org|net|gov|edu|io|co|us|info|biz|me|app|dev|xyz|tv|ai|news|site|store|tech|online|shop|club|pro|page|link)(?:\/[^\s]*)?)/gi;

function renderSettingsLinks(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(SETTINGS_URL_REGEX);
  const urls = text.match(SETTINGS_URL_REGEX) || [];
  if (urls.length === 0) return text;

  const result: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) result.push(part);
    if (i < urls.length) {
      result.push(
        <span key={i} className="underline text-primary break-all cursor-pointer">{urls[i]}</span>
      );
    }
  });
  return result;
}

function SettingsPhonePreview({ message, orgName }: { message: string; orgName: string }) {
  const rendered = message
    .replace(/\{firstName\}/g, "Jane")
    .replace(/\{orgName\}/g, orgName || "Your Org");

  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="rounded-2xl border bg-muted/30 p-3">
        <div className="flex items-center gap-2 pb-2 border-b mb-3">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Message Preview
          </span>
        </div>
        <div className="space-y-2">
          {rendered ? (
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap break-words">
              {renderSettingsLinks(rendered)}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Type a message to see a preview
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SignupMessagesTab({
  form,
  setForm,
  orgData,
  saving,
  onSave,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  orgData: OrgData | null;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <Card>
        <CardHeader>
          <CardTitle>Welcome Message</CardTitle>
          <CardDescription>
            Sent automatically to new contacts who opt in to receive messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="welcomeMessage">Message Text</Label>
                <Textarea
                  id="welcomeMessage"
                  value={form.welcomeMessage}
                  onChange={(e) =>
                    setForm((p: any) => ({
                      ...p,
                      welcomeMessage: e.target.value,
                    }))
                  }
                  placeholder="Welcome {firstName}! You've been added to updates from {orgName}. Reply STOP to opt out."
                  rows={4}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Merge fields:
                </span>
                {["{firstName}", "{orgName}"].map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() =>
                      setForm((p: any) => ({
                        ...p,
                        welcomeMessage: p.welcomeMessage + field,
                      }))
                    }
                    className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>
            <SettingsPhonePreview
              message={form.welcomeMessage}
              orgName={form.name}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button disabled={saving} onClick={onSave}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Opt-out confirmation */}
      <Card>
        <CardHeader>
          <CardTitle>Opt-Out Confirmation</CardTitle>
          <CardDescription>
            Sent when a contact replies STOP or otherwise opts out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="optOutMessage">Message Text</Label>
                <Textarea
                  id="optOutMessage"
                  value={form.optOutMessage}
                  onChange={(e) =>
                    setForm((p: any) => ({
                      ...p,
                      optOutMessage: e.target.value,
                    }))
                  }
                  placeholder="You've been unsubscribed from {orgName}. Reply START to re-subscribe."
                  rows={4}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Merge fields:
                </span>
                {["{firstName}", "{orgName}"].map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() =>
                      setForm((p: any) => ({
                        ...p,
                        optOutMessage: p.optOutMessage + field,
                      }))
                    }
                    className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>
            <SettingsPhonePreview
              message={form.optOutMessage}
              orgName={form.name}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button disabled={saving} onClick={onSave}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ===========================================================================
// TEAM TAB
// ===========================================================================

function TeamTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Management</CardTitle>
        <CardDescription>
          Invite members, assign roles, and manage your team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/team">
          <Button>
            <Users className="h-4 w-4 mr-2" />
            Manage Team
            <ExternalLink className="h-3.5 w-3.5 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// CUSTOMIZE TAB
// ===========================================================================

function CustomizeTab({
  form,
  setForm,
  saving,
  onSave,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Political Disclaimer</CardTitle>
          <CardDescription>
            Required for political campaigns. Auto-appended to all outbound
            messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disclaimer">Disclaimer Text</Label>
            <Textarea
              id="disclaimer"
              value={form.politicalDisclaimer}
              onChange={(e) =>
                setForm((p: any) => ({
                  ...p,
                  politicalDisclaimer: e.target.value,
                }))
              }
              placeholder="Paid for by Citizens for Progress"
              rows={2}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty if not a political organization. FEC requires
            &quot;Paid for by&quot; disclosures on political communications.
          </p>
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
                onChange={(e) =>
                  setForm((p: any) => ({
                    ...p,
                    quietHoursStart: e.target.value,
                  }))
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
                  setForm((p: any) => ({
                    ...p,
                    quietHoursEnd: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Default: 9 PM - 8 AM. Messages hitting quiet hours are automatically
            delayed to the next send window.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Timezone</CardTitle>
          <CardDescription>
            Used for quiet hours enforcement and scheduled campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={form.timezone}
              onValueChange={(value) =>
                setForm((p: any) => ({ ...p, timezone: value }))
              }
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {US_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message Signature</CardTitle>
          <CardDescription>
            Optional footer text appended to all outbound messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="messageSignature">Signature / Footer</Label>
            <Textarea
              id="messageSignature"
              value={form.messageSignature}
              onChange={(e) =>
                setForm((p: any) => ({
                  ...p,
                  messageSignature: e.target.value,
                }))
              }
              placeholder="- Sent by the Campaign Team"
              rows={2}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty to send messages without a footer. Appended after the
            disclaimer (if set).
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button disabled={saving} onClick={onSave}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ===========================================================================
// BILLING TAB
// ===========================================================================

function BillingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Credits</CardTitle>
        <CardDescription>
          View your balance, purchase credits, and manage payment methods.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/billing">
          <Button>
            <CreditCard className="h-4 w-4 mr-2" />
            Manage Billing
            <ExternalLink className="h-3.5 w-3.5 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// SECURITY TAB
// ===========================================================================

function SecurityTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Security</CardTitle>
        <CardDescription>
          Protect your account with two-factor authentication and manage
          security settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link
          href="/settings/security"
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
        >
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="font-medium text-sm">
              Two-Factor Authentication & Security
            </p>
            <p className="text-xs text-muted-foreground">
              Add an extra layer of security with an authenticator app (TOTP),
              manage backup codes, and more.
            </p>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// INTEGRATIONS TAB
// ===========================================================================

function IntegrationsTab({ orgData }: { orgData: OrgData | null }) {
  const twilioConnected = !!orgData?.twilioAccountSid;

  return (
    <div className="space-y-6">
      {/* Twilio status */}
      <Card>
        <CardHeader>
          <CardTitle>Twilio</CardTitle>
          <CardDescription>
            SMS/MMS messaging provider connection status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            {twilioConnected ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">
                {twilioConnected ? "Connected" : "Not Connected"}
              </p>
              {twilioConnected && orgData?.twilioAccountSid && (
                <p className="text-xs text-muted-foreground font-mono">
                  Account SID: {orgData.twilioAccountSid}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Manage API keys for programmatic access to CivicText.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/api-keys"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <KeyRound className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-sm">Manage API Keys</p>
              <p className="text-xs text-muted-foreground">
                Create, rotate, and revoke API keys.
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            Send real-time events to your servers when messages are sent,
            delivered, or contacts opt in/out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/webhooks"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <Webhook className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-sm">Manage Webhooks</p>
              <p className="text-xs text-muted-foreground">
                Configure endpoints and select events.
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// APPEARANCE TAB
// ===========================================================================

function AppearanceTab({
  form,
  setForm,
  saving,
  onSave,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  saving: boolean;
  onSave: () => void;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Color Mode</CardTitle>
          <CardDescription>
            Choose between light, dark, or system-preferred appearance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`
                  flex items-center gap-3 p-4 rounded-lg border-2 transition-all
                  ${
                    theme === value
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/50 hover:bg-muted"
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accent Color</CardTitle>
          <CardDescription>
            Pick a primary accent color for the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() =>
                  setForm((p: any) => ({ ...p, accentColor: value }))
                }
                title={label}
                className={`
                  relative h-10 w-10 rounded-full transition-transform hover:scale-110 focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                  ${form.accentColor === value ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}
                `}
                style={{ backgroundColor: value }}
              >
                <span className="sr-only">{label}</span>
              </button>
            ))}
            {/* Clear selection */}
            {form.accentColor && (
              <button
                onClick={() =>
                  setForm((p: any) => ({ ...p, accentColor: "" }))
                }
                className="h-10 px-3 rounded-full border text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {form.accentColor && (
            <p className="text-xs text-muted-foreground mt-3">
              Selected: {ACCENT_COLORS.find((c) => c.value === form.accentColor)?.label ?? form.accentColor}
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button disabled={saving} onClick={onSave}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Appearance"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
