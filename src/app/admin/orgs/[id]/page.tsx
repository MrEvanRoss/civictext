"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getOrgDetailAction,
  approveOrgAction,
  suspendOrgAction,
  reactivateOrgAction,
  addCreditsAction,
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
} from "@/server/actions/admin";
import { adminAddUserToOrgAction } from "@/server/actions/team";
import { NativeSelect } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
  ExternalLink,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

type Tab = "overview" | "campaigns" | "contacts" | "interest-lists" | "templates" | "webhooks" | "auto-reply" | "consent";

export default function AdminOrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspend, setShowSuspend] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addingCredits, setAddingCredits] = useState(false);
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
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactPage, setContactPage] = useState(1);
  const [interestLists, setInterestLists] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [autoReplyRules, setAutoReplyRules] = useState<any[]>([]);
  const [consentLogs, setConsentLogs] = useState<any>(null);
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

  useEffect(() => {
    loadOrg();
  }, [orgId]);

  useEffect(() => {
    loadTabData();
  }, [activeTab, contactPage, consentPage]);

  async function loadOrg() {
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
  }

  async function handleSaveRates() {
    setSavingRates(true);
    try {
      await updateOrgRatesAction(orgId, rateForm);
      setEditingRates(false);
      await loadOrg();
    } catch (err: any) {
      alert(err.message);
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
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingTypes(false);
    }
  }

  async function loadTabData() {
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
  }

  async function handleSearchContacts() {
    setContactPage(1);
    setTabLoading(true);
    try {
      setContacts(await getOrgContactsAction(orgId, { page: 1, search: contactSearch || undefined }));
    } finally {
      setTabLoading(false);
    }
  }

  async function handleSuspend() {
    if (!suspendReason.trim()) return;
    try {
      await suspendOrgAction(orgId, suspendReason.trim());
      setSuspendReason("");
      setShowSuspend(false);
      await loadOrg();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleApprove() {
    try {
      await approveOrgAction(orgId);
      await loadOrg();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleReactivate() {
    try {
      await reactivateOrgAction(orgId);
      await loadOrg();
    } catch (err: any) {
      alert(err.message);
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
    } catch (err: any) {
      alert(err.message);
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
      setAddAmount("");
      await loadOrg();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingCredits(false);
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
    } catch (err: any) {
      alert(err.message);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push("/admin/orgs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{org.name}</h1>
              <Badge
                variant={
                  org.status === "ACTIVE"
                    ? "success"
                    : org.status === "SUSPENDED"
                    ? "destructive"
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
        <div className="flex gap-2">
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
            <Button variant="destructive" size="sm" onClick={() => setShowSuspend(!showSuspend)}>
              <AlertTriangle className="h-4 w-4 mr-1" />
              Suspend
            </Button>
          )}
          {org.status === "SUSPENDED" && (
            <Button variant="default" size="sm" onClick={handleReactivate}>
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Suspend Form */}
      {showSuspend && (
        <div className="border border-destructive/50 rounded-lg p-4 bg-destructive/5">
          <p className="text-sm font-medium mb-2">Reason for suspension:</p>
          <div className="flex gap-2">
            <Input
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g., Violation of terms, high complaint rate..."
              className="flex-1"
            />
            <Button variant="destructive" size="sm" onClick={handleSuspend}>
              Confirm Suspend
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSuspend(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
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
      <div className="border-b flex gap-0 overflow-x-auto">
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
        <div className="grid grid-cols-2 gap-6">
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
              <p className="text-sm font-medium mb-2">Add Credits</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="5.00"
                    min="5"
                    className="pl-7"
                  />
                </div>
                <Button size="sm" onClick={handleAddCredits} disabled={addingCredits}>
                  {addingCredits ? "Adding..." : "Add Credits"}
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                {[25, 50, 100, 500].map((amt) => (
                  <Button key={amt} variant="outline" size="sm" onClick={() => setAddAmount(amt.toString())} className="text-xs">
                    ${amt}
                  </Button>
                ))}
              </div>
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
          <div className="border rounded-lg p-4 col-span-2">
            <h2 className="font-semibold mb-3">Allowed Campaign Types</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Control which campaign types this client can create. Uncheck types that are not permitted for compliance reasons (e.g., entities that must use P2P only).
            </p>
            <div className="grid grid-cols-5 gap-3">
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

          {/* Users Table */}
          <div className="border rounded-lg p-4 col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Team Members ({org.users.length})</h2>
              <Button size="sm" onClick={() => setShowAddUser(!showAddUser)}>
                {showAddUser ? "Cancel" : "Add User"}
              </Button>
            </div>
            {showAddUser && (
              <div className="border rounded-lg p-4 bg-muted/30 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
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
                    <td className="p-2 text-right">
                      {user.twoFactorEnabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          onClick={async () => {
                            if (!confirm(`Reset 2FA for ${user.name || user.email}? They will need to set it up again.`)) return;
                            try {
                              await resetUser2FAAction(user.id);
                              toast.success(`2FA reset for ${user.name || user.email}`);
                              loadOrg();
                            } catch (err: any) {
                              toast.error(err.message || "Failed to reset 2FA");
                            }
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
    </div>
  );
}
