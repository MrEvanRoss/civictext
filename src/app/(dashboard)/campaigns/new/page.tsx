"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Steps } from "@/components/ui/steps";
import { createCampaignAction } from "@/server/actions/campaigns";
import { listSegmentsAction } from "@/server/actions/contacts";
import { countSegments } from "@/lib/sms-utils";

const WIZARD_STEPS = [
  { title: "Name & Type" },
  { title: "Audience" },
  { title: "Compose" },
  { title: "Schedule" },
  { title: "Review" },
];

const CAMPAIGN_TYPES = [
  {
    value: "BROADCAST",
    label: "Broadcast",
    description: "Send one message to an entire segment at once.",
  },
  {
    value: "P2P",
    label: "Peer-to-Peer",
    description: "Initial broadcast, replies routed to human agents.",
  },
  {
    value: "DRIP",
    label: "Drip Sequence",
    description: "Multi-step campaign with delays and branching.",
  },
  {
    value: "AUTO_REPLY",
    label: "Auto-Reply",
    description: "Keyword-triggered automatic responses.",
  },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [segments, setSegments] = useState<any[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    loadSegments();
  }, []);

  async function loadSegments() {
    try {
      const data = await listSegmentsAction();
      setSegments(data);
    } catch (err) {
      console.error("Failed to load segments:", err);
    }
  }

  const charCount = messageBody.length;
  const segmentCount = countSegments(messageBody);

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return !!(name && type);
      case 1:
        return type === "AUTO_REPLY" || !!segmentId;
      case 2:
        return !!messageBody;
      case 3:
        return scheduleType === "now" || !!scheduledAt;
      default:
        return true;
    }
  }

  async function handleCreate() {
    setLoading(true);
    setError("");

    try {
      const campaign = await createCampaignAction({
        name,
        type: type as any,
        segmentId: segmentId || undefined,
        messageBody,
        mediaUrl: mediaUrl || undefined,
        scheduledAt:
          scheduleType === "later" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
      });
      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  }

  const selectedSegment = segments.find((s) => s.id === segmentId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Campaign</h1>
        <p className="text-muted-foreground">
          Create a new messaging campaign.
        </p>
      </div>

      <Steps steps={WIZARD_STEPS} currentStep={step} />

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step 0: Name & Type */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Name & Type</CardTitle>
            <CardDescription>
              Choose a name and the type of campaign to create.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Early Voting Reminder"
              />
            </div>

            <div className="space-y-2">
              <Label>Campaign Type *</Label>
              <div className="grid grid-cols-2 gap-3">
                {CAMPAIGN_TYPES.map((ct) => (
                  <div
                    key={ct.value}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      type === ct.value
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setType(ct.value)}
                  >
                    <p className="font-medium text-sm">{ct.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ct.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => setStep(1)} disabled={!canProceed()}>
              Next: Audience
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 1: Audience */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Audience</CardTitle>
            <CardDescription>
              {type === "AUTO_REPLY"
                ? "Auto-reply campaigns respond to incoming messages. No audience selection needed."
                : "Choose a segment of contacts to send this campaign to. Opted-out contacts are automatically excluded."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {type === "AUTO_REPLY" ? (
              <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                Auto-reply campaigns respond to keywords from any contact. No
                audience selection is needed.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Segment *</Label>
                  <Select
                    value={segmentId}
                    onChange={(e) => setSegmentId(e.target.value)}
                  >
                    <option value="">Select a segment...</option>
                    {segments.map((seg) => (
                      <option key={seg.id} value={seg.id}>
                        {seg.name} ({seg.contactCount} contacts)
                      </option>
                    ))}
                  </Select>
                </div>

                {selectedSegment && (
                  <div className="rounded-md bg-muted p-4 text-sm">
                    <p className="font-medium">{selectedSegment.name}</p>
                    <p className="text-muted-foreground mt-1">
                      {selectedSegment.contactCount} contacts will receive this
                      campaign (minus opted-out).
                    </p>
                  </div>
                )}

                {segments.length === 0 && (
                  <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
                    No segments found. Create a segment in{" "}
                    <a href="/contacts/segments" className="underline">
                      Contacts &gt; Segments
                    </a>{" "}
                    first.
                  </div>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)} disabled={!canProceed()}>
              Next: Compose
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Compose */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Compose Message</CardTitle>
            <CardDescription>
              Write your message. Use {"{{firstName}}"}, {"{{lastName}}"}, or{" "}
              {"{{orgName}}"} for personalization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Message Body *</Label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Hi {{firstName}}, early voting starts tomorrow! Find your polling location at..."
                rows={6}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{charCount} characters</span>
                <span>
                  {segmentCount} SMS segment{segmentCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">
                Insert merge field:
              </span>
              {["{{firstName}}", "{{lastName}}", "{{orgName}}"].map((field) => (
                <Button
                  key={field}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setMessageBody((prev) => prev + field)}
                >
                  {field}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mediaUrl">MMS Media URL (optional)</Label>
              <Input
                id="mediaUrl"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-xs text-muted-foreground">
                Attach an image or GIF to send as MMS.
              </p>
            </div>

            {/* Message Preview */}
            <div className="mt-4">
              <Label>Preview</Label>
              <div className="mt-2 max-w-xs mx-auto">
                <div className="bg-muted rounded-2xl p-4 text-sm">
                  <div className="bg-primary text-primary-foreground rounded-xl px-3 py-2 ml-auto max-w-[85%] w-fit">
                    {messageBody
                      .replace(/\{\{firstName\}\}/g, "Jane")
                      .replace(/\{\{lastName\}\}/g, "Smith")
                      .replace(/\{\{orgName\}\}/g, "CivicText") || (
                      <span className="opacity-50">Your message here...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!canProceed()}>
              Next: Schedule
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Schedule */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>
              Choose when to send this campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  scheduleType === "now"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setScheduleType("now")}
              >
                <p className="font-medium text-sm">Send Now</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start sending immediately after review.
                </p>
              </div>
              <div
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  scheduleType === "later"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setScheduleType("later")}
              >
                <p className="font-medium text-sm">Schedule for Later</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pick a date and time to send.
                </p>
              </div>
            </div>

            {scheduleType === "later" && (
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Send Date & Time *</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Messages will respect quiet hours (8AM-9PM in recipient timezone).
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => setStep(4)} disabled={!canProceed()}>
              Next: Review
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Campaign</CardTitle>
            <CardDescription>
              Review your campaign details before creating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{name}</dd>

              <dt className="text-muted-foreground">Type</dt>
              <dd>
                <Badge variant="outline">
                  {CAMPAIGN_TYPES.find((t) => t.value === type)?.label}
                </Badge>
              </dd>

              <dt className="text-muted-foreground">Audience</dt>
              <dd>
                {type === "AUTO_REPLY"
                  ? "All contacts (auto-reply)"
                  : selectedSegment
                    ? `${selectedSegment.name} (${selectedSegment.contactCount} contacts)`
                    : "No segment"}
              </dd>

              <dt className="text-muted-foreground">Schedule</dt>
              <dd>
                {scheduleType === "now"
                  ? "Send immediately"
                  : new Date(scheduledAt).toLocaleString()}
              </dd>

              <dt className="text-muted-foreground">Segments</dt>
              <dd>
                {segmentCount} SMS segment{segmentCount !== 1 ? "s" : ""} per
                message
              </dd>
            </dl>

            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Message:</p>
              <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                {messageBody}
              </div>
            </div>

            {mediaUrl && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Media:</p>
                <p className="text-sm font-mono text-xs">{mediaUrl}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading
                ? "Creating..."
                : scheduleType === "now"
                  ? "Create & Send Now"
                  : "Create & Schedule"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
