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
  updateOrgPlanAction,
} from "@/server/actions/admin";
import {
  ArrowLeft,
  Building2,
  Users,
  MessageSquare,
  Phone,
  Shield,
  AlertTriangle,
} from "lucide-react";

export default function AdminOrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspend, setShowSuspend] = useState(false);
  const [planEditing, setPlanEditing] = useState(false);
  const [planForm, setPlanForm] = useState({
    tier: "",
    monthlyAllotment: 0,
    overagePermitted: false,
    overageRate: 0,
  });

  useEffect(() => {
    loadOrg();
  }, [orgId]);

  async function loadOrg() {
    setLoading(true);
    try {
      const data = await getOrgDetailAction(orgId);
      setOrg(data);
      if (data.messagingPlan) {
        setPlanForm({
          tier: data.messagingPlan.tier || "",
          monthlyAllotment: data.messagingPlan.monthlyAllotment || 0,
          overagePermitted: data.messagingPlan.overagePermitted || false,
          overageRate: Number(data.messagingPlan.overageRate) || 0,
        });
      }
    } catch (err) {
      console.error("Failed to load org:", err);
    } finally {
      setLoading(false);
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
      alert(err.message || "Failed to suspend org");
    }
  }

  async function handleApprove() {
    try {
      await approveOrgAction(orgId);
      await loadOrg();
    } catch (err: any) {
      alert(err.message || "Failed to approve org");
    }
  }

  async function handleReactivate() {
    try {
      await reactivateOrgAction(orgId);
      await loadOrg();
    } catch (err: any) {
      alert(err.message || "Failed to reactivate org");
    }
  }

  async function handleUpdatePlan() {
    try {
      await updateOrgPlanAction(orgId, {
        tier: planForm.tier,
        monthlyAllotment: planForm.monthlyAllotment,
        overagePermitted: planForm.overagePermitted,
        overageRate: planForm.overageRate,
      });
      setPlanEditing(false);
      await loadOrg();
    } catch (err: any) {
      alert(err.message || "Failed to update plan");
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
          {org.status === "PENDING_APPROVAL" && (
            <Button variant="default" size="sm" onClick={handleApprove}>
              Approve Account
            </Button>
          )}
          {org.status === "ACTIVE" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowSuspend(!showSuspend)}
            >
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
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium">30-Day Messages</span>
          </div>
          <p className="text-2xl font-bold">{org.stats.messageCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            {org.stats.deliveryRate}% delivery rate
          </p>
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
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-medium">Contacts</span>
          </div>
          <p className="text-2xl font-bold">{org._count.contacts.toLocaleString()}</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-medium">30-Day Opt-Outs</span>
          </div>
          <p className="text-2xl font-bold">{org.stats.optOutCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Plan Section */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Messaging Plan</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPlanEditing(!planEditing)}
            >
              {planEditing ? "Cancel" : "Edit"}
            </Button>
          </div>
          {planEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Tier</label>
                <Input
                  value={planForm.tier}
                  onChange={(e) => setPlanForm({ ...planForm, tier: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Monthly Allotment</label>
                <Input
                  type="number"
                  value={planForm.monthlyAllotment}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, monthlyAllotment: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={planForm.overagePermitted}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, overagePermitted: e.target.checked })
                  }
                />
                <label className="text-sm">Overage Permitted</label>
              </div>
              {planForm.overagePermitted && (
                <div>
                  <label className="text-xs font-medium">Overage Rate ($/msg)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={planForm.overageRate}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, overageRate: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              )}
              <Button size="sm" onClick={handleUpdatePlan}>
                Save Plan
              </Button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tier</span>
                <span className="font-medium">{org.messagingPlan?.tier || "None"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Allotment</span>
                <span className="font-medium">
                  {org.messagingPlan?.monthlyAllotment?.toLocaleString() || "0"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overage</span>
                <span className="font-medium">
                  {org.messagingPlan?.overagePermitted ? "Permitted" : "Blocked"}
                </span>
              </div>
              {org.messagingPlan?.overageRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overage Rate</span>
                  <span className="font-medium">${org.messagingPlan.overageRate}/msg</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Twilio Section */}
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Twilio Configuration</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subaccount SID</span>
              <span className="font-mono text-xs">
                {org.twilioSubaccount?.accountSid || "Not provisioned"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Messaging Service</span>
              <span className="font-mono text-xs">
                {org.twilioSubaccount?.messagingServiceSid || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Brand Registration</span>
              <Badge
                variant={
                  org.brandRegistrations?.[0]?.status === "APPROVED"
                    ? "success"
                    : org.brandRegistrations?.[0]?.status === "REJECTED"
                    ? "destructive"
                    : "secondary"
                }
              >
                {org.brandRegistrations?.[0]?.status || "None"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Campaign Registration</span>
              <Badge
                variant={
                  org.campaignRegistrations?.[0]?.status === "APPROVED"
                    ? "success"
                    : org.campaignRegistrations?.[0]?.status === "REJECTED"
                    ? "destructive"
                    : "secondary"
                }
              >
                {org.campaignRegistrations?.[0]?.status || "None"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Phone Numbers</span>
              <span className="font-medium">{org.phoneNumbers?.length || 0}</span>
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
      </div>

      {/* Users Table */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Team Members</h2>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Name</th>
              <th className="text-left p-2 font-medium">Email</th>
              <th className="text-left p-2 font-medium">Role</th>
              <th className="text-left p-2 font-medium">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {org.users.map((user: any) => (
              <tr key={user.id} className="border-t">
                <td className="p-2">{user.name || "—"}</td>
                <td className="p-2 text-muted-foreground">{user.email}</td>
                <td className="p-2">
                  <Badge variant="secondary">{user.role}</Badge>
                </td>
                <td className="p-2 text-muted-foreground">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
