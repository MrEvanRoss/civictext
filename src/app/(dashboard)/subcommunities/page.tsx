"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  listSubcommunitiesAction,
  createSubcommunityAction,
} from "@/server/actions/subcommunities";
import { Plus, Users } from "lucide-react";

// ---------------------------------------------------------------------------
// Color helper for subcommunity avatars
// ---------------------------------------------------------------------------
const SUBCOMMUNITY_COLORS = [
  "bg-pink-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-blue-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function getSubcommunityColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SUBCOMMUNITY_COLORS[Math.abs(hash) % SUBCOMMUNITY_COLORS.length];
}

export default function SubcommunitiesPage() {
  const router = useRouter();
  const [subcommunities, setSubcommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinKeyword, setJoinKeyword] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSubcommunities();
  }, []);

  async function loadSubcommunities() {
    setLoading(true);
    try {
      const data = await listSubcommunitiesAction();
      setSubcommunities(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load subcommunities");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      await createSubcommunityAction({
        name,
        description: description || undefined,
        joinKeyword: joinKeyword || undefined,
        isPublic,
      });
      setName("");
      setDescription("");
      setJoinKeyword("");
      setIsPublic(true);
      setShowCreate(false);
      toast.success("Subcommunity created successfully");
      await loadSubcommunities();
    } catch (err: any) {
      toast.error(err.message || "Failed to create subcommunity");
    } finally {
      setCreating(false);
    }
  }

  function resetCreateForm() {
    setShowCreate(false);
    setName("");
    setDescription("");
    setJoinKeyword("");
    setIsPublic(true);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subcommunities</h1>
          <p className="text-muted-foreground">
            Groups within your Community
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Subcommunity</CardTitle>
            <CardDescription>
              Create a group to organize contacts within your community.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subcommunityName">Name *</Label>
                <Input
                  id="subcommunityName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Volunteers, VIP Donors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joinKeyword">Join Keyword (optional)</Label>
                <Input
                  id="joinKeyword"
                  value={joinKeyword}
                  onChange={(e) =>
                    setJoinKeyword(
                      e.target.value.toUpperCase().replace(/\s/g, "")
                    )
                  }
                  placeholder="e.g., VIP, VOLUNTEER"
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Contacts can text this keyword to join. Must be unique.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcommunityDescription">
                Description (optional)
              </Label>
              <Textarea
                id="subcommunityDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Internal description for your team"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="isPublic"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
              <Label htmlFor="isPublic" className="cursor-pointer">
                {isPublic ? "Public" : "Private"} &mdash;{" "}
                <span className="text-muted-foreground font-normal">
                  {isPublic
                    ? "Visible to all team members"
                    : "Only visible to admins"}
                </span>
              </Label>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" onClick={resetCreateForm}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
            >
              {creating ? "Creating..." : "Create Subcommunity"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : subcommunities.length === 0 && !showCreate ? (
        /* Empty State */
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium mb-1">
              No subcommunities yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Subcommunities let you organize contacts into groups. Create one
              to start grouping your community members.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Subcommunity
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Subcommunities Grid */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subcommunities.map((sub) => {
            const color = getSubcommunityColor(sub.name);
            const memberCount = sub._count?.members ?? sub.memberCount ?? 0;
            return (
              <Card
                key={sub.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => router.push(`/subcommunities/${sub.id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    {/* Colored circle avatar */}
                    <div
                      className={`h-12 w-12 rounded-full ${color} flex items-center justify-center text-white text-lg font-bold shrink-0`}
                    >
                      {sub.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{sub.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {memberCount}{" "}
                        {memberCount === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>
                  {/* Keyword badge */}
                  {sub.joinKeyword && (
                    <div className="mt-3">
                      <Badge variant="outline" className="text-xs font-mono">
                        Keyword: {sub.joinKeyword}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
