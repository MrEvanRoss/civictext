"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getOrgDetailAction,
  approveOrgAction,
  setInactiveOrgAction,
  archiveOrgAction,
  reactivateOrgAction,
  addCreditsAction,
  removeCreditsAction,
  updateOrgRatesAction,
  updateAllowedCampaignTypesAction,
  getOrgCampaignsAction,
  getOrgContactsAction,
  getOrgInterestListsAction,
  getOrgTemplatesAction,
  getOrgWebhooksAction,
  getOrgAutoReplyRulesAction,
  getOrgConsentLogsAction,
  startImpersonationAction,
  resetUser2FAAction,
  resetUserPasswordAction,
  deleteOrgAction,
  togglePollingLocationsAction,
} from "@/server/actions/admin";
import { adminAddUserToOrgAction } from "@/server/actions/team";
import { NativeSelect } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Building2,
  Users,
  MessageSquare,
  Phone,
  Shield,
  AlertTriangle,
  DollarSign,
  Megaphone,
  Contact,
  Hash,
  FileText,
  Webhook,
  MessageSquareReply,
  ScrollText,
  LogIn,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";

type Tab = "overview" | "campaigns" | "contacts" | "interest-lists" | "templates" | "webhooks" | "auto-reply" | "consent";

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: Date | null;
  twoFactorEnabled: boolean;
}

interface OrgMessagingPlan {
  balanceCents: number;
  totalSpentCents: number;
  smsRateCents: number;
  mmsRateCents: number;
  phoneNumberFeeCents: number;
}

interface OrgPhoneNumber {
  id: string;
  phoneNumber: string;
  status: string;
}

interface OrgBrandRegistration {
  status: string;
  createdAt: Date;
}

interface OrgCampaignRegistration {
  status: string;
  createdAt: Date;
}

interface OrgDetailData {
  id: string;
  name: string;
  slug: string;
  status: string;
  allowedCampaignTypes: string[];
  pollingLocationsEnabled: boolean;
  users: OrgUser[];
  messagingPlan: OrgMessagingPlan | null;
  twilioSubaccount: { accountSid: string; messagingServiceSid: string | null } | null;
  brandRegistrations: OrgBrandRegistration[];
  campaignRegistrations: OrgCampaignRegistration[];
  phoneNumbers: OrgPhoneNumber[];
  _count: { contacts: number; campaigns: number; messages: number };
  stats: {
    messageCount: number;
    deliveredCount: number;
    deliveryRate: string;
    optOutCount: number;
  };
}

interface OrgCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  messageBody: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  responseCount: number;
  optOutCount: number;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  createdBy: { name: string } | null;
}

interface OrgContact {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  tags: string[];
  optInStatus: string;
  lastMessageAt: Date | null;
  createdAt: Date;
}

interface OrgContactsPage {
  contacts: OrgContact[];
  total: number;
  page: number;
  totalPages: number;
}

interface OrgInterestList {
  id: string;
  name: string;
  keyword: string;
  description: string | null;
  memberCount: number;
  isActive: boolean;
  createdAt: Date;
}

interface OrgTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  usageCount: number;
  createdAt: Date;
}

interface OrgWebhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  failCount: number;
  lastError: string | null;
  createdAt: Date;
}

interface OrgAutoReplyRule {
  id: string;
  name: string;
  keywords: string[];
  replyBody: string;
  isActive: boolean;
  priority: number;
}

interface ConsentLogEntry {
  id: string;
  orgId: string;
  createdAt: Date;
  contactId: string | null;
  action: string;
  source: string;
  metadata: unknown;
  contact: { phone: string; firstName: string | null; lastName: string | null } | null;
}

interface OrgConsentLogsPage {
  logs: ConsentLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminOrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<OrgDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inactiveReason, setInactiveReason] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteOrgDialog, setShowDeleteOrgDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [showReset2FADialog, setShowReset2FADialog] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<string | null>(null);
  const [pending2FAUserName, setPending2FAUserName] = useState<string>("");
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [pendingPasswordUserId, setPendingPasswordUserId] = useState<string | null>(null);
  const [pendingPasswordUserName, setPendingPasswordUserName] = useState<string>("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addingCredits, setAddingCredits] = useState(false);
  const [creditMode, setCreditMode] = useState<"add" | "remove">("add");
  const [showRemoveCreditsDialog, setShowRemoveCreditsDialog] = useState(false);
  const [removingCredits, setRemovingCredits] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "SENDER",
  });

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Tab data
  const [campaigns, setCampaigns] = useState<OrgCampaign[]>([]);
  const [contacts, setContacts] = useState<OrgContactsPage | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactPage, setContactPage] = useState(1);
  const [interestLists, setInterestLists] = useState<OrgInterestList[]>([]);
  const [templates, setTemplates] = useState<OrgTemplate[]>([]);
  const [webhooks, setWebhooks] = useState<OrgWebhook[]>([]);
  const [autoReplyRules, setAutoReplyRules] = useState<OrgAutoReplyRule[]>([]);
  const [consentLogs, setConsentLogs] = useState<OrgConsentLogsPage | null>(null);
  const [consentPage, setConsentPage] = useState(1);
  const [tabLoading, setTabLoading] = useState(false);

  // Editable pricing
  const [editingRates, setEditingRates] = useState(false);
  const [rateForm, setRateForm] = useState({ smsRateCents: 4, mmsRateCents: 8, phoneNumberFeeCents: 500 });
  const [savingRates, setSavingRates] = useState(false);

  // Allowed campaign types
  const [savingTypes, setSavingTypes] = useState(false);

  const ALL_CAMPAIGN_TYPES = [
    { value: "BROADCAST", label: "Broadcast", desc: "One message to entire segment" },
    { value: "P2P", label: "Peer-to-Peer (P2P)", desc: "Initial send, replies to human agents" },
    { value: "GOTV", label: "GOTV", desc: "Get Out The Vote sequences" },
    { value: "DRIP", label: "Drip Sequence", desc: "Multi-step with delays" },
    { value: "AUTO_REPLY", label: "Auto-Reply", desc: "Keyword-triggered responses" },
  ];

  const loadOrg = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrgDetailAction(orgId);
      setOrg(data);
      setRateForm({
        smsRateCents: data.messagingPlan?.smsRateCents ?? 4,
        mmsRateCents: data.messagingPlan?.mmsRateCents ?? 8,
        phoneNumberFeeCents: data.messagingPlan?.phoneNumberFeeCents ?? 500,
      });
    } catch (err) {
      console.error("Failed to load org:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

  async function handleSaveRates() {
    setSavingRates(true);
    try {
      await updateOrgRatesAction(orgId, rateForm);
      setEditingRates(false);
      await loadOrg();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSavingRates(false);
    }
  }

  async function handleToggleCampaignType(type: string) {
    const current = org?.allowedCampaignTypes || ALL_CAMPAIGN_TYPES.map((t) => t.value);
    const updated = current.includes(type)
      ? current.filter((t: string) => t !== type)
      : [...current, type];

    if (updated.length === 0) {
      alert("At least one campaign type must be allowed.");
      return;
    }

    setSavingTypes(true);
    try {
      await updateAllowedCampaignTypesAction(orgId, updated);
      await loadOrg();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSavingTypes(false);
    }
  }

  async function handleTogglePollingLocations() {
    if (!org) return;
    try {
      await togglePollingLocationsAction(orgId, !org.pollingLocationsEnabled);
      await loadOrg();
      toast.success(`Polling Locations ${!org.pollingLocationsEnabled ? "enabled" : "disabled"}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  const loadTabData = useCallback(async () => {
    if (activeTab === "overview") return;
    setTabLoading(true);
    try {
      switch (activeTab) {
        case "campaigns":
          setCampaigns(await getOrgCampaignsAction(orgId));
          break;
        case "contacts":
          setContacts(await getOrgContactsAction(orgId, { page: contactPage, search: contactSearch || undefined }));
          break;
        case "interest-lists":
          setInterestLists(await getOrgInterestListsAction(orgId));
          break;
        case "templates":
          setTemplates(await getOrgTemplatesAction(orgId));
          break;
        case "webhooks":
          setWebhooks(await getOrgWebhooksAction(orgId));
          break;
        case "auto-reply":
          setAutoReplyRules(await getOrgAutoReplyRulesAction(orgId));
          break;
        case "consent":
          setConsentLogs(await getOrgConsentLogsAction(orgId, { page: consentPage }));
          break;
      }
    } catch (err) {
      console.error("Failed to load tab data:", err);
    } finally {
      setTabLoading(false);
    }
  }, [activeTab, orgId, contactPage, contactSearch, consentPage]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  async function handleSearchContacts() {
    setContactPage(1);
    setTabLoading(true);
    try {
      setContacts(await getOrgContactsAction(orgId, { page: 1, search: contactSearch || undefined }));
    } finally {
      setTabLoading(false);
    }
  }

  async function handleSetInactive() {
    if (!inactiveReason.trim()) return;
    try {
      await setInactiveOrgAction(orgId, inactiveReason.trim());
      setInactiveReason("");
      setShowInactive(false);
      await loadOrg();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  }

  function handleArchive() {
    setShowArchiveDialog(true);
  }

  async function confirmArchive() {
    setShowArchiveDialog(false);
    try {
      await archiveOrgAction(orgId);
      await loadOrg();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  }

  async function confirmDeleteOrg() {
    if (!org || deleteConfirmName !== org.name) return;
    setDeletingOrg(true);
    try {
      await deleteOrgAction(orgId);
      toast.success(`Organization "${org.name}" permanently deleted`);
      router.push("/admin");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete organization");
      setDeletingOrg(false);
    }
  }

  async function confirmReset2FA() {
    if (!pending2FAUserId) return;
    setShowReset2FADialog(false);
    try {
      await resetUser2FAAction(pending2FAUserId);
      toast.success(`2FA reset for ${pending2FAUserName}`);
      loadOrg();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reset 2FA");
    } finally {
      setPending2FAUserId(null);
      setPending2FAUserName("");
    }
  }

  async function confirmResetPassword() {
    if (!pendingPasswordUserId || !newPasswordInput) return;
    if (newPasswordInput.length < 12) {
      toast.error("Password must be at least 12 characters");
      return;
    }
    setShowResetPasswordDialog(false);
    try {
      await resetUserPasswordAction(pendingPasswordUserId, newPasswordInput);
      toast.success(`Password reset for ${pendingPasswordUserName}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setPendingPasswordUserId(null);
      setPendingPasswordUserName("");
      setNewPasswordInput("");
    }
  }

  async function handleApprove() {
    try {
      await approveOrgAction(orgId);
      await loadOrg();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  }

  async function handleReactivate() {
    try {
      await reactivateOrgAction(orgId);
      await loadOrg();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  }

  async function handleAddUser() {
    if (!userForm.name || !userForm.email || !userForm.password) {
      alert("Please fill in all fields");
      return;
    }
    if (userForm.password.length < 12) {
      alert("Password must be at least 12 characters");
      return;
    }
    setAddingUser(true);
    try {
      await adminAddUserToOrgAction({ orgId, ...userForm });
      setShowAddUser(false);
      setUserForm({ name: "", email: "", password: "", role: "SENDER" });
      await loadOrg();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setAddingUser(false);
    }
  }

  async function handleAddCredits() {
    const dollars = parseFloat(addAmount);
    if (!dollars || dollars <= 0) {
      alert("Enter a valid dollar amount");
      return;
    }
    setAddingCredits(true);
    try {
      await addCreditsAction(orgId, Math.round(dollars * 100));
      toast.success(`Added $${dollars.toFixed(2)} in credits`);
      setAddAmount("");
      await loadOrg();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setAddingCredits(false);
    }
  }

  async function handleRemoveCredits() {
    const dollars = parseFloat(addAmount);
    if (!dollars || dollars <= 0) {
      alert("Enter a valid dollar amount");
      return;
    }
    setShowRemoveCreditsDialog(true);
  }

  async function confirmRemoveCredits() {
    const dollars = parseFloat(addAmount);
    setShowRemoveCreditsDialog(false);
    setRemovingCredits(true);
    try {
      await removeCreditsAction(orgId, Math.round(dollars * 100));
      toast.success(`Removed $${dollars.toFixed(2)} in credits`);
      setAddAmount("");
      await loadOrg();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove credits");
    } finally {
      setRemovingCredits(false);
    }
  }

  async function handleImpersonate() {
    try {
      const result = await startImpersonationAction(orgId);
      // Store impersonation state in localStorage
      localStorage.setItem(
        "civictext_impersonation",
        JSON.stringify({
          adminUserId: result.adminUserId,
          targetOrgId: result.targetOrgId,
          targetOrgName: result.targetOrgName,
          targetUserId: result.targetUserId,
          startedAt: new Date().toISOString(),
        })
      );
      // Redirect to a special impersonation login endpoint
      window.location.href = `/api/admin/impersonate?userId=${result.targetUserId}&orgId=${result.targetOrgId}`;
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading organization...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  const balanceDollars = ((org.messagingPlan?.balanceCents || 0) / 100).toFixed(2);
  const totalSpentDollars = ((org.messagingPlan?.totalSpentCents || 0) / 100).toFixed(2);

  const TABS: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: "overview", label: "Overview", icon: Building2 },
    { key: "campaigns", label: "Campaigns", icon: Megaphone, count: org._count?.campaigns },
    { key: "contacts", label: "Contacts", icon: Contact, count: org._count?.contacts },
    { key: "interest-lists", label: "Interest Lists", icon: Hash },
    { key: "templates", label: "Templates", icon: FileText },
    { key: "webhooks", label: "Webhooks", icon: Webhook },
    { key: "auto-reply", label: "Auto-Reply", icon: MessageSquareReply },
    { key: "consent", label: "Consent Log", icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={() => router.push("/admin/orgs")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{org.name}</h1>
              <Badge
                variant={
                  org.status === "ACTIVE"
                    ? "success"
                    : org.status === "INACTIVE"
                    ? "destructive"
                    : org.status === "ARCHIVED"
                    ? "secondary"
                    : org.status === "PENDING_APPROVAL"
                    ? "warning"
                    : "secondary"
                }
              >
                {org.status === "PENDING_APPROVAL" ? "PENDING APPROVAL" : org.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{org.slug} &middot; ID: {org.id}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleImpersonate}>
            <LogIn className="h-4 w-4 mr-1" />
            Log In As Client
          </Button>
          {org.status === "PENDING_APPROVAL" && (
            <Button variant="default" size="sm" onClick={handleApprove}>
              Approve Account
            </Button>
          )}
          {org.status === "ACTIVE" && (
            <Button variant="destructive" size="sm" onClick={() => setShowInactive(!showInactive)}>
              <AlertTriangle className="h-4 w-4 mr-1" />
              Set Inactive
            </Button>
          )}
          {(org.status === "INACTIVE" || org.status === "ARCHIVED") && (
            <Button variant="default" size="sm" onClick={handleReactivate}>
              Reactivate
            </Button>
          )}
          {(org.status === "ACTIVE" || org.status === "INACTIVE") && (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              Archive
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeleteConfirmName("");
              setShowDeleteOrgDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Org
          </Button>
        </div>
      </div>

      {/* Set Inactive Form */}
      {showInactive && (
        <div className="border border-destructive/50 rounded-lg p-4 bg-destructive/5">
          <p className="text-sm font-medium mb-2">Reason for setting inactive:</p>
          <div className="flex gap-2">
            <Input
              value={inactiveReason}
              onChange={(e) => setInactiveReason(e.target.value)}
              placeholder="e.g., Violation of terms, high complaint rate, client request..."
              className="flex-1"
            />
            <Button variant="destructive" size="sm" onClick={handleSetInactive}>
              Confirm Inactive
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowInactive(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Balance</span>
          </div>
          <p className="text-2xl font-bold font-mono">${balanceDollars}</p>
          <p className="text-xs text-muted-foreground">${totalSpentDollars} spent</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium">30-Day Msgs</span>
          </div>
          <p className="text-2xl font-bold">{org.stats.messageCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{org.stats.deliveryRate}% delivered</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Contact className="h-4 w-4" />
            <span className="text-xs font-medium">Contacts</span>
          </div>
          <p className="text-2xl font-bold">{(org._count?.contacts || 0).toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Users</span>
          </div>
          <p className="text-2xl font-bold">{org.users.length}</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-medium">30-Day Opt-Outs</span>
          </div>
          <p className="text-2xl font-bold">{org.stats.optOutCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 ml-1">
                  {tab.count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Balance & Pricing */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Balance & Pricing</h2>
              {!editingRates ? (
                <Button variant="outline" size="sm" onClick={() => setEditingRates(true)} className="text-xs">
                  Edit Rates
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button size="sm" onClick={handleSaveRates} disabled={savingRates} className="text-xs">
                    {savingRates ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditingRates(false); setRateForm({ smsRateCents: org.messagingPlan?.smsRateCents ?? 4, mmsRateCents: org.messagingPlan?.mmsRateCents ?? 8, phoneNumberFeeCents: org.messagingPlan?.phoneNumberFeeCents ?? 500 }); }} className="text-xs">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="font-medium font-mono">${balanceDollars}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">SMS Rate</span>
                {editingRates ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={rateForm.smsRateCents}
                      onChange={(e) => setRateForm((p) => ({ ...p, smsRateCents: parseFloat(e.target.value) || 0 }))}
                      className="w-20 h-7 text-xs text-right"
                    />
                    <span className="text-xs text-muted-foreground">&#162;/segment</span>
                  </div>
                ) : (
                  <span className="font-medium">{Number(org.messagingPlan?.smsRateCents || 4) % 1 === 0 ? (org.messagingPlan?.smsRateCents || 4) : Number(org.messagingPlan?.smsRateCents || 4).toFixed(2)}&#162;/segment</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">MMS Rate</span>
                {editingRates ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={rateForm.mmsRateCents}
                      onChange={(e) => setRateForm((p) => ({ ...p, mmsRateCents: parseFloat(e.target.value) || 0 }))}
                      className="w-20 h-7 text-xs text-right"
                    />
                    <span className="text-xs text-muted-foreground">&#162;/message</span>
                  </div>
                ) : (
                  <span className="font-medium">{Number(org.messagingPlan?.mmsRateCents || 8) % 1 === 0 ? (org.messagingPlan?.mmsRateCents || 8) : Number(org.messagingPlan?.mmsRateCents || 8).toFixed(2)}&#162;/message</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Phone Number Fee</span>
                {editingRates ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(rateForm.phoneNumberFeeCents / 100).toFixed(2)}
                      onChange={(e) => setRateForm((p) => ({ ...p, phoneNumberFeeCents: Math.round(parseFloat(e.target.value || "0") * 100) }))}
                      className="w-20 h-7 text-xs text-right"
                    />
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                ) : (
                  <span className="font-medium">${((org.messagingPlan?.phoneNumberFeeCents || 500) / 100).toFixed(2)}/mo</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Numbers</span>
                <span className="font-medium">{org.phoneNumbers?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Spent</span>
                <span className="font-medium font-mono">${totalSpentDollars}</span>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant={creditMode === "add" ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => { setCreditMode("add"); setAddAmount(""); }}
                >
                  Add Credits
                </Button>
                <Button
                  variant={creditMode === "remove" ? "destructive" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => { setCreditMode("remove"); setAddAmount(""); }}
                >
                  Remove Credits
                </Button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="5.00"
                    min="0.01"
                    className={`pl-7 ${creditMode === "remove" ? "border-destructive/50" : ""}`}
                  />
                </div>
                {creditMode === "add" ? (
                  <Button size="sm" onClick={handleAddCredits} disabled={addingCredits}>
                    {addingCredits ? "Adding..." : "Add"}
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" onClick={handleRemoveCredits} disabled={removingCredits}>
                    {removingCredits ? "Removing..." : "Remove"}
                  </Button>
                )}
              </div>
              {creditMode === "add" && (
                <div className="flex gap-2 mt-2">
                  {[25, 50, 100, 500].map((amt) => (
                    <Button key={amt} variant="outline" size="sm" onClick={() => setAddAmount(amt.toString())} className="text-xs">
                      ${amt}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Twilio Section */}
          <div className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">Twilio Configuration</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subaccount SID</span>
                <span className="font-mono text-xs">{org.twilioSubaccount?.accountSid || "Not provisioned"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messaging Service</span>
                <span className="font-mono text-xs">{org.twilioSubaccount?.messagingServiceSid || "\u2014"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Brand Registration</span>
                <Badge variant={org.brandRegistrations?.[0]?.status === "APPROVED" ? "success" : org.brandRegistrations?.[0]?.status === "REJECTED" ? "destructive" : "secondary"}>
                  {org.brandRegistrations?.[0]?.status || "None"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campaign Registration</span>
                <Badge variant={org.campaignRegistrations?.[0]?.status === "APPROVED" ? "success" : org.campaignRegistrations?.[0]?.status === "REJECTED" ? "destructive" : "secondary"}>
                  {org.campaignRegistrations?.[0]?.status || "None"}
                </Badge>
              </div>
            </div>
            {org.phoneNumbers?.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium mb-2">Phone Numbers</p>
                <div className="space-y-1">
                  {org.phoneNumbers.map((pn: any) => (
                    <div key={pn.id || pn.phoneNumber} className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-mono">{pn.phoneNumber}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Allowed Campaign Types */}
          <div className="border rounded-lg p-4 md:col-span-2">
            <h2 className="font-semibold mb-3">Allowed Campaign Types</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Control which campaign types this client can create. Uncheck types that are not permitted for compliance reasons (e.g., entities that must use P2P only).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {ALL_CAMPAIGN_TYPES.map((ct) => {
                const allowed = org?.allowedCampaignTypes || ALL_CAMPAIGN_TYPES.map((t) => t.value);
                const isAllowed = allowed.includes(ct.value);
                return (
                  <label
                    key={ct.value}
                    className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isAllowed ? "border-primary bg-primary/5" : "border-muted opacity-60"
                    } ${savingTypes ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isAllowed}
                      onChange={() => handleToggleCampaignType(ct.value)}
                      disabled={savingTypes}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium leading-tight">{ct.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ct.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="border rounded-lg p-4 md:col-span-2">
            <h2 className="font-semibold mb-3">Feature Toggles</h2>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Polling Locations</p>
                <p className="text-xs text-muted-foreground">
                  Enables the Polling Location directory for mapping precincts to polling places in GOTV campaigns.
                </p>
              </div>
              <Button
                variant={org.pollingLocationsEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleTogglePollingLocations}
              >
                {org.pollingLocationsEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </div>

          {/* Users Table */}
          <div className="border rounded-lg p-4 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Team Members ({org.users.length})</h2>
              <Button size="sm" onClick={() => setShowAddUser(!showAddUser)}>
                {showAddUser ? "Cancel" : "Add User"}
              </Button>
            </div>
            {showAddUser && (
              <div className="border rounded-lg p-4 bg-muted/30 mb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Full name" />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="user@example.com" />
                  </div>
                  <div>
                    <Label className="text-xs">Password (min 12 chars)</Label>
                    <Input type="text" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Temporary password" />
                  </div>
                  <div>
                    <Label className="text-xs">Role</Label>
                    <NativeSelect value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="SENDER">Sender</option>
                      <option value="VIEWER">Viewer</option>
                    </NativeSelect>
                  </div>
                </div>
                <Button size="sm" onClick={handleAddUser} disabled={addingUser}>
                  {addingUser ? "Adding..." : "Add User"}
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Name</th>
                  <th className="text-left p-2 font-medium">Email</th>
                  <th className="text-left p-2 font-medium">Role</th>
                  <th className="text-left p-2 font-medium">2FA</th>
                  <th className="text-left p-2 font-medium">Last Login</th>
                  <th className="text-right p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {org.users.map((user: any) => (
                  <tr key={user.id} className="border-t">
                    <td className="p-2">{user.name || "\u2014"}</td>
                    <td className="p-2 text-muted-foreground">{user.email}</td>
                    <td className="p-2"><Badge variant="secondary">{user.role}</Badge></td>
                    <td className="p-2">
                      {user.twoFactorEnabled ? (
                        <Badge variant="success" className="text-[10px]">
                          <ShieldCheck className="h-3 w-3 mr-0.5" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          <ShieldOff className="h-3 w-3 mr-0.5" />
                          Off
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="p-2 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setPendingPasswordUserId(user.id);
                          setPendingPasswordUserName(user.name || user.email);
                          setNewPasswordInput("");
                          setShowResetPasswordDialog(true);
                        }}
                      >
                        Reset Password
                      </Button>
                      {user.twoFactorEnabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            setPending2FAUserId(user.id);
                            setPending2FAUserName(user.name || user.email);
                            setShowReset2FADialog(true);
                          }}
                        >
                          Reset 2FA
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Tab */}
      {activeTab === "campaigns" && (
        <div className="border rounded-lg overflow-hidden">
          {tabLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No campaigns created yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Campaign</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Recipients</th>
                  <th className="text-right p-3 font-medium">Sent</th>
                  <th className="text-right p-3 font-medium">Delivered</th>
                  <th className="text-right p-3 font-medium">Failed</th>
                  <th className="text-right p-3 font-medium">Opt-Outs</th>
                  <th className="text-left p-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{c.messageBody}</p>
                    </td>
                    <td className="p-3"><Badge variant="outline">{c.type}</Badge></td>
                    <td className="p-3">
                      <Badge variant={c.status === "COMPLETED" ? "success" : c.status === "SENDING" ? "warning" : c.status === "FAILED" ? "destructive" : "secondary"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">{c.totalRecipients.toLocaleString()}</td>
                    <td className="p-3 text-right">{c.sentCount.toLocaleString()}</td>
                    <td className="p-3 text-right">{c.deliveredCount.toLocaleString()}</td>
                    <td className="p-3 text-right text-destructive">{c.failedCount}</td>
                    <td className="p-3 text-right">{c.optOutCount}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                      {c.createdBy && <span className="block">{c.createdBy.name}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearchContacts(); }}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSearchContacts}>Search</Button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            {tabLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading contacts...</div>
            ) : !contacts || contacts.contacts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No contacts found.</div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Phone</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Tags</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Last Msg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.contacts.map((c: any) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-3">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}</td>
                        <td className="p-3 font-mono text-xs">{c.phone}</td>
                        <td className="p-3 text-muted-foreground text-xs">{c.email || "-"}</td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {(c.tags || []).slice(0, 3).map((t: string) => (
                              <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                            ))}
                            {c.tags?.length > 3 && <Badge variant="outline" className="text-xs">+{c.tags.length - 3}</Badge>}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={c.optInStatus === "OPTED_IN" ? "success" : c.optInStatus === "OPTED_OUT" ? "destructive" : "warning"}>
                            {c.optInStatus}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString() : "Never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contacts.totalPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t">
                    <span className="text-xs text-muted-foreground">Page {contacts.page} of {contacts.totalPages} ({contacts.total} total)</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={contactPage <= 1} onClick={() => setContactPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={contactPage >= contacts.totalPages} onClick={() => setContactPage((p) => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Interest Lists Tab */}
      {activeTab === "interest-lists" && (
        <div className="border rounded-lg overflow-hidden">
          {tabLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : interestLists.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No interest lists created.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Keyword</th>
                  <th className="text-right p-3 font-medium">Members</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {interestLists.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-3 font-medium">{l.name}</td>
                    <td className="p-3 font-mono">{l.keyword}</td>
                    <td className="p-3 text-right">{l.memberCount}</td>
                    <td className="p-3"><Badge variant={l.isActive ? "success" : "secondary"}>{l.isActive ? "Active" : "Inactive"}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="border rounded-lg overflow-hidden">
          {tabLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No templates created.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Body</th>
                  <th className="text-right p-3 font-medium">Used</th>
                  <th className="text-left p-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3"><Badge variant="outline">{t.category}</Badge></td>
                    <td className="p-3 text-muted-foreground text-xs max-w-xs truncate">{t.body}</td>
                    <td className="p-3 text-right">{t.usageCount}</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === "webhooks" && (
        <div className="border rounded-lg overflow-hidden">
          {tabLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : webhooks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No webhooks configured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">URL</th>
                  <th className="text-left p-3 font-medium">Events</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Failures</th>
                  <th className="text-left p-3 font-medium">Last Error</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w) => (
                  <tr key={w.id} className="border-t">
                    <td className="p-3 font-mono text-xs max-w-xs truncate">{w.url}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {w.events.map((e: string) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                      </div>
                    </td>
                    <td className="p-3"><Badge variant={w.isActive ? "success" : "secondary"}>{w.isActive ? "Active" : "Disabled"}</Badge></td>
                    <td className="p-3 text-right">{w.failCount}</td>
                    <td className="p-3 text-xs text-destructive max-w-xs truncate">{w.lastError || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Auto-Reply Tab */}
      {activeTab === "auto-reply" && (
        <div className="border rounded-lg overflow-hidden">
          {tabLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : autoReplyRules.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No auto-reply rules configured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Keywords</th>
                  <th className="text-left p-3 font-medium">Reply</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {autoReplyRules.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {r.keywords.map((k: string) => <Badge key={k} variant="outline" className="text-xs font-mono">{k}</Badge>)}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs max-w-xs truncate">{r.replyBody}</td>
                    <td className="p-3"><Badge variant={r.isActive ? "success" : "secondary"}>{r.isActive ? "Active" : "Disabled"}</Badge></td>
                    <td className="p-3 text-right">{r.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Consent Log Tab */}
      {activeTab === "consent" && (
        <div className="border rounded-lg overflow-hidden">
          {tabLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : !consentLogs || consentLogs.logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No consent audit logs.</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Contact</th>
                    <th className="text-left p-3 font-medium">Action</th>
                    <th className="text-left p-3 font-medium">Source</th>
                    <th className="text-left p-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {consentLogs.logs.map((log: any) => (
                    <tr key={log.id} className="border-t">
                      <td className="p-3 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3">
                        <span className="font-mono text-xs">{log.contact?.phone || "-"}</span>
                        {log.contact?.firstName && <span className="text-xs text-muted-foreground ml-2">{log.contact.firstName} {log.contact.lastName}</span>}
                      </td>
                      <td className="p-3">
                        <Badge variant={log.action?.includes("opt_in") || log.action?.includes("OPT_IN") ? "success" : "destructive"}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{log.source || "-"}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{log.details || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {consentLogs.totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t">
                  <span className="text-xs text-muted-foreground">Page {consentLogs.page} of {consentLogs.totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={consentPage <= 1} onClick={() => setConsentPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={consentPage >= consentLogs.totalPages} onClick={() => setConsentPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive organization?</AlertDialogTitle>
            <AlertDialogDescription>
              Archive this organization? It will be hidden from active views but all data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReset2FADialog} onOpenChange={setShowReset2FADialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset 2FA?</AlertDialogTitle>
            <AlertDialogDescription>
              Reset 2FA for {pending2FAUserName}? They will need to set it up again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset2FA}>Reset 2FA</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResetPasswordDialog} onOpenChange={(open) => {
        setShowResetPasswordDialog(open);
        if (!open) setNewPasswordInput("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Set a new password for {pendingPasswordUserName}. Must be at least 12 characters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password (min 12 chars)"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              minLength={12}
              className="mt-1"
            />
            {newPasswordInput.length > 0 && newPasswordInput.length < 12 && (
              <p className="text-xs text-destructive mt-1">
                Password must be at least 12 characters ({12 - newPasswordInput.length} more needed)
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmResetPassword}
              disabled={newPasswordInput.length < 12}
            >
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRemoveCreditsDialog} onOpenChange={setShowRemoveCreditsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Credits</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>${parseFloat(addAmount || "0").toFixed(2)}</strong> from {org?.name}&apos;s balance? This will reduce their available credits immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveCredits}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Credits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteOrgDialog} onOpenChange={(open) => {
        setShowDeleteOrgDialog(open);
        if (!open) setDeleteConfirmName("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Permanently Delete Organization</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will permanently delete <strong>{org?.name}</strong> and ALL of its data including users, contacts, campaigns, messages, and billing records. This cannot be undone.
              </span>
              <span className="block font-medium">
                Type the organization name to confirm:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              placeholder={org?.name || "Organization name"}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              className="border-destructive/50"
            />
            {deleteConfirmName.length > 0 && deleteConfirmName !== org?.name && (
              <p className="text-xs text-destructive mt-1">
                Name does not match
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingOrg}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteOrg}
              disabled={deleteConfirmName !== org?.name || deletingOrg}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingOrg ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
