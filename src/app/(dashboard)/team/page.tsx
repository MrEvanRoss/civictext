"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  listTeamMembersAction,
  addTeamMemberAction,
  updateTeamMemberRoleAction,
  removeTeamMemberAction,
} from "@/server/actions/team";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Users, Plus, X, Trash2, UserPlus } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SENDER: "Sender",
  VIEWER: "Viewer",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Full access except billing and ownership transfer",
  MANAGER: "Create campaigns, import contacts, view analytics",
  SENDER: "Send campaigns and reply to messages",
  VIEWER: "View-only access to analytics and campaigns",
};

export default function TeamPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "SENDER",
  });

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const data = await listTeamMembersAction();
      setMembers(data);
    } catch (err) {
      console.error("Failed to load team:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!form.name || !form.email || !form.password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (form.password.length < 12) {
      toast.error("Password must be at least 12 characters");
      return;
    }
    setAdding(true);
    try {
      await addTeamMemberAction(form);
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "SENDER" });
      toast.success("Team member added successfully");
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to add team member");
    } finally {
      setAdding(false);
    }
  }

  async function handleChangeRole(userId: string, newRole: string) {
    try {
      await updateTeamMemberRoleAction(userId, newRole);
      toast.success("Role updated successfully");
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the team? They will lose access immediately.`)) {
      return;
    }
    try {
      await removeTeamMemberAction(userId);
      toast.success(`${name} has been removed from the team`);
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove team member");
    }
  }

  function getInitials(name: string | null | undefined): string {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">
            Manage who has access to your organization ({members.length} member{members.length !== 1 ? "s" : ""})
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
      </div>

      {/* Add Member Form */}
      {showAdd && (
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Add Team Member</h2>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Jane Smith"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g., jane@example.com"
              />
            </div>
            <div>
              <Label>Temporary Password (min 12 characters)</Label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="They should change this after first login"
              />
            </div>
            <div>
              <Label>Role</Label>
              <NativeSelect
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="ADMIN">Admin - {ROLE_DESCRIPTIONS.ADMIN}</option>
                <option value="MANAGER">Manager - {ROLE_DESCRIPTIONS.MANAGER}</option>
                <option value="SENDER">Sender - {ROLE_DESCRIPTIONS.SENDER}</option>
                <option value="VIEWER">Viewer - {ROLE_DESCRIPTIONS.VIEWER}</option>
              </NativeSelect>
            </div>
          </div>
          <Button onClick={handleAdd} disabled={adding}>
            {adding ? "Adding..." : "Add Team Member"}
          </Button>
        </div>
      )}

      {/* Members Grid */}
      {members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-20">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted/50 mb-6">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Team Members Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Add team members to collaborate on campaigns. Assign roles to control what
              each person can access and do within your organization.
            </p>
            <Button onClick={() => setShowAdd(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Your First Team Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member.id} className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{member.name || "\u2014"}</p>
                      {member.role !== "OWNER" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(member.id, member.name)}
                          className="text-destructive hover:text-destructive -mr-2 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  {member.role === "OWNER" ? (
                    <Badge variant="default">Owner</Badge>
                  ) : (
                    <NativeSelect
                      value={member.role}
                      onChange={(e) => handleChangeRole(member.id, e.target.value)}
                      className="w-32 h-8 text-xs"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="SENDER">Sender</option>
                      <option value="VIEWER">Viewer</option>
                    </NativeSelect>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {member.lastLoginAt
                      ? `Last login ${new Date(member.lastLoginAt).toLocaleDateString()}`
                      : "Never logged in"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
