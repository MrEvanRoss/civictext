"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Save, MessageCircle } from "lucide-react";
import { PhonePreview } from "@/components/campaigns/phone-preview";
import {
  getGrowthInfoAction,
  updateWelcomeMessageAction,
} from "@/server/actions/growth";

const MERGE_FIELDS = [
  { tag: "{{firstName}}", label: "First Name" },
  { tag: "{{lastName}}", label: "Last Name" },
  { tag: "{{orgName}}", label: "Org Name" },
];

export default function ActivationTextPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [message, setMessage] = useState("");
  const [originalMessage, setOriginalMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const info = await getGrowthInfoAction();
        setOrgName(info.orgName);
        setMessage(info.welcomeMessage || "");
        setOriginalMessage(info.welcomeMessage || "");
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const insertMergeField = (tag: string) => {
    setMessage((prev) => prev + tag);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWelcomeMessageAction(message);
      setOriginalMessage(message);
      toast.success("Welcome message saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = message !== originalMessage;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/growth">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Activation Text
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure the welcome message automatically sent to new contacts
            when they sign up.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Welcome Message
            </CardTitle>
            <CardDescription>
              This message is sent to new contacts when they opt in. Use merge
              fields to personalize the message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message Body</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Welcome to ${orgName}! You'll now receive updates from us. Reply STOP at any time to opt out.`}
                rows={6}
                maxLength={1600}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{message.length} / 1600 characters</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Merge Fields</Label>
              <div className="flex flex-wrap gap-2">
                {MERGE_FIELDS.map((field) => (
                  <Button
                    key={field.tag}
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => insertMergeField(field.tag)}
                  >
                    {field.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Click a merge field to insert it at the end of your message.
              </p>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">Tips</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Keep it short and welcoming</li>
                <li>
                  Always include opt-out language: &quot;Reply STOP to
                  unsubscribe&quot;
                </li>
                <li>Mention your organization name so they know who is texting</li>
              </ul>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Welcome Message"}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              This is how your welcome message will appear on a phone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PhonePreview
              message={
                message ||
                `Welcome to ${orgName}! You'll now receive updates from us. Reply STOP at any time to opt out.`
              }
              orgName={orgName}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
