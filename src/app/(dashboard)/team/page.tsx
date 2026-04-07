"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  listTeamMembersAction,
  addTeamMemberAction,
  updateTeamMemberRoleAction,
  removeTeamMemberAction,
} from "@/server/actions/team";
import { Users, Plus, X, Trash2 } from "lucide-react";

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
      alert("Please fill in all fields");
      return;
    }
    if (form.password.length < 12) {
      alert("Password must be at least 12 characters");
      return;
    }
    setAdding(true);
    try {
      await addTeamMemberAction(form);
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "SENDER" });
      await loadMembers();
    } catch (err: any) {
      alert(err.message || "Failed to add team member");
    } finally {
      setAdding(false);
    }
  }

  async function handleChangeRole(userId: string, newRole: string) {
    try {
      await updateTeamMemberRoleAction(userId, newRole);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the team? They will lose access immediately.`)) {
      return;
    }
    try {
      await removeTeamMemberAction(userId);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || "Failed to remove team member");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading team...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="ADMIN">Admin - {ROLE_DESCRIPTIONS.ADMIN}</option>
                <option value="MANAGER">Manager - {ROLE_DESCRIPTIONS.MANAGER}</option>
                <option value="SENDER">Sender - {ROLE_DESCRIPTIONS.SENDER}</option>
                <option value="VIEWER">Viewer - {ROLE_DESCRIPTIONS.VIEWER}</option>
              </Select>
            </div>
          </div>
          <Button onClick={handleAdd} disabled={adding}>
            {adding ? "Adding..." : "Add Team Member"}
          </Button>
        </div>
      )}

      {/* Members Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium">Last Login</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {(member.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium">{member.name || "\u2014"}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{member.email}</td>
                <td className="p-3">
                  {member.role === "OWNER" ? (
                    <Badge variant="default">Owner</Badge>
                  ) : (
                    <Select
                      value={member.role}
                      onChange={(e) => handleChangeRole(member.id, e.target.value)}
                      className="w-32 h-8 text-xs"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="SENDER">Sender</option>
                      <option value="VIEWER">Viewer</option>
                    </Select>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">
                  {member.lastLoginAt
                    ? new Date(member.lastLoginAt).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="p-3 text-right">
                  {member.role !== "OWNER" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member.id, member.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
