"use client";

import React, { useState, useEffect } from "react";
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
import { MediaUpload } from "@/components/ui/media-upload";
import { createCampaignAction, sendTestMessageAction, getAllowedCampaignTypesAction } from "@/server/actions/campaigns";
import { listSegmentsAction } from "@/server/actions/contacts";
import { countSegments, hasUnicodeChars, getRemainingChars } from "@/lib/sms-utils";
import { DEFAULT_SMS_RATE_CENTS, DEFAULT_MMS_RATE_CENTS } from "@/lib/constants";

const URL_REGEX = /https?:\/\/[^\s]+/g;

/**
 * Client-side preview: replace URLs with sample short-link format.
 */
function previewWithShortLinks(text: string): string {
  return text.replace(URL_REGEX, () => {
    const domain = typeof window !== "undefined" ? window.location.host : "civictext.app";
    return `${window.location.protocol}//${domain}/r/xxxxxx`;
  });
}

/**
 * Render message text with links styled as they appear on phones.
 */
function renderPreviewWithLinks(text: string): React.ReactNode {
  if (!text) return null;
  const shortened = previewWithShortLinks(text);
  const parts = shortened.split(URL_REGEX);
  const urls = shortened.match(URL_REGEX) || [];

  if (urls.length === 0) return shortened;

  const result: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) result.push(part);
    if (i < urls.length) {
      result.push(
        <span key={i} className="underline text-blue-200 break-all">
          {urls[i]}
        </span>
      );
    }
  });
  return result;
}

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
    value: "GOTV",
    label: "GOTV",
    description: "Get Out The Vote — multi-touch Election Day sequence with polling reminders.",
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
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  // GOTV settings
  const [gotvElectionDate, setGotvElectionDate] = useState("");
  const [gotvPollHours, setGotvPollHours] = useState("7:00 AM - 8:00 PM");
  const [gotvDefaultLocation, setGotvDefaultLocation] = useState("");

  // Test message
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: string; error?: string } | null>(null);

  useEffect(() => {
    loadSegments();
    loadAllowedTypes();
  }, []);

  async function loadSegments() {
    try {
      const data = await listSegmentsAction();
      setSegments(data);
    } catch (err) {
      console.error("Failed to load segments:", err);
    }
  }

  async function loadAllowedTypes() {
    try {
      const types = await getAllowedCampaignTypesAction();
      setAllowedTypes(types);
    } catch {
      setAllowedTypes(["BROADCAST", "P2P", "GOTV", "DRIP", "AUTO_REPLY"]);
    }
  }

  const visibleCampaignTypes = CAMPAIGN_TYPES.filter(
    (ct) => allowedTypes.length === 0 || allowedTypes.includes(ct.value)
  );

  const charCount = messageBody.length;
  const segmentCount = countSegments(messageBody);
  const isUnicode = hasUnicodeChars(messageBody);
  const remaining = getRemainingChars(messageBody);
  const hasMms = !!mediaUrl;
  const costPerRecipientCents = hasMms
    ? DEFAULT_MMS_RATE_CENTS
    : segmentCount * DEFAULT_SMS_RATE_CENTS;

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
        ...(type === "GOTV" && {
          gotvSettings: {
            electionDate: gotvElectionDate || undefined,
            pollHours: gotvPollHours || undefined,
            defaultPollingLocation: gotvDefaultLocation || undefined,
          },
        }),
      });
      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTest() {
    if (!testPhone.trim() || !messageBody.trim()) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const result = await sendTestMessageAction({
        phone: testPhone.trim(),
        messageBody,
        mediaUrl: mediaUrl || undefined,
      });
      setTestResult({ success: `Test message queued to ${result.phone}` });
      setTimeout(() => {
        setTestResult(null);
        setShowTestModal(false);
        setTestPhone("");
      }, 3000);
    } catch (err: any) {
      setTestResult({ error: err.message || "Failed to send test message" });
    } finally {
      setTestSending(false);
    }
  }

  const selectedSegment = segments.find((s) => s.id === segmentId);

  // Detect URLs in message for preview
  const messageUrls = messageBody.match(URL_REGEX) || [];
  const hasLinks = messageUrls.length > 0;

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
                {visibleCampaignTypes.map((ct) => (
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
            {/* GOTV Quick Templates */}
            {type === "GOTV" && (
              <div className="space-y-2">
                <Label>GOTV Message Templates</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Polling Reminder", body: "Hi {{firstName}}, Election Day is {{electionDate}}! Your polling place is {{pollingLocation}}. Polls are open {{pollHours}}. Make your voice heard! Reply STOP to opt out." },
                    { label: "Early Vote", body: "{{firstName}}, early voting is open now through {{earlyVoteEnd}}! Skip the lines and vote early at {{pollingLocation}}. Reply STOP to opt out." },
                    { label: "Ride to Polls", body: "Hi {{firstName}}, need a ride to vote? Reply YES and we'll help arrange transportation to your polling place. Every vote matters! Reply STOP to opt out." },
                    { label: "Have You Voted?", body: "Hi {{firstName}}, have you voted yet? Polls close at {{pollCloseTime}} today. Your polling place: {{pollingLocation}}. Reply VOTED if you already voted! Reply STOP to opt out." },
                  ].map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      className="text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      onClick={() => setMessageBody(tpl.body)}
                    >
                      <span className="text-sm font-medium">{tpl.label}</span>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{tpl.body}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Message Body *</Label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={type === "GOTV" ? "Hi {{firstName}}, Election Day is tomorrow! Your polling place is {{pollingLocation}}..." : "Hi {{firstName}}, early voting starts tomorrow! Find your polling location at..."}
                rows={6}
              />
              {/* Character & Segment Counter */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {charCount} character{charCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-muted-foreground">&middot;</span>
                    <span className={`font-medium ${segmentCount > 3 ? "text-orange-600" : segmentCount > 1 ? "text-yellow-600" : "text-green-600"}`}>
                      {segmentCount} segment{segmentCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-muted-foreground">&middot;</span>
                    <span className="text-muted-foreground">
                      {remaining} char{remaining !== 1 ? "s" : ""} left in segment
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {(costPerRecipientCents / 100).toFixed(2)}¢/recipient
                  </span>
                </div>

                {/* Segment progress bar */}
                {charCount > 0 && (
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(segmentCount, 10) }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          i < segmentCount
                            ? segmentCount > 3
                              ? "bg-orange-400"
                              : segmentCount > 1
                                ? "bg-yellow-400"
                                : "bg-green-400"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                    {segmentCount > 10 && (
                      <span className="text-xs text-muted-foreground">+{segmentCount - 10}</span>
                    )}
                  </div>
                )}

                {isUnicode && (
                  <p className="text-xs text-orange-600">
                    Unicode detected (emoji or special characters). Segment limit reduced from 160 to 70 characters.
                  </p>
                )}
                {segmentCount > 3 && (
                  <p className="text-xs text-orange-600">
                    Long messages cost more. Consider shortening to reduce per-recipient cost.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">
                Insert merge field:
              </span>
              {[
                "{{firstName}}",
                "{{lastName}}",
                "{{fullName}}",
                "{{prefix}}",
                "{{suffix}}",
                "{{address}}",
                "{{precinct}}",
                "{{orgName}}",
                ...(type === "GOTV" ? [
                  "{{pollingLocation}}",
                  "{{electionDate}}",
                  "{{pollHours}}",
                  "{{pollCloseTime}}",
                  "{{earlyVoteEnd}}",
                ] : []),
              ].map((field) => (
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

            <div className="space-y-3">
              <Label>MMS Media (optional)</Label>
              <MediaUpload
                value={mediaUrl}
                onUpload={(url) => setMediaUrl(url)}
                onRemove={() => setMediaUrl("")}
              />
            </div>

            {/* Message Preview */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <Label>Message Preview</Label>
                {messageBody && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTestModal(true)}
                  >
                    Send Test Message
                  </Button>
                )}
              </div>
              <div className="max-w-sm mx-auto">
                {/* Phone frame */}
                <div className="border-2 border-muted rounded-[2rem] p-1 bg-background shadow-lg">
                  <div className="bg-muted rounded-[1.5rem] p-4">
                    <p className="text-[10px] text-muted-foreground text-center mb-3">Text Message Preview</p>
                    {messageBody ? (
                      <div className="space-y-2">
                        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 text-sm ml-auto max-w-[90%] w-fit whitespace-pre-wrap break-words">
                          {renderPreviewWithLinks(
                            messageBody
                              .replace(/\{\{prefix\}\}/g, "Ms.")
                              .replace(/\{\{firstName\}\}/g, "Jane")
                              .replace(/\{\{lastName\}\}/g, "Smith")
                              .replace(/\{\{suffix\}\}/g, "")
                              .replace(/\{\{fullName\}\}/g, "Ms. Jane Smith")
                              .replace(/\{\{phone\}\}/g, "(212) 555-1234")
                              .replace(/\{\{email\}\}/g, "jane@example.com")
                              .replace(/\{\{street\}\}/g, "123 Main St")
                              .replace(/\{\{city\}\}/g, "Springfield")
                              .replace(/\{\{state\}\}/g, "IL")
                              .replace(/\{\{zip\}\}/g, "62701")
                              .replace(/\{\{address\}\}/g, "123 Main St, Springfield, IL 62701")
                              .replace(/\{\{precinct\}\}/g, "District 5")
                              .replace(/\{\{orgName\}\}/g, "CivicText")
                              .replace(/\{\{pollingLocation\}\}/g, gotvDefaultLocation || "Your local polling place")
                              .replace(/\{\{electionDate\}\}/g, gotvElectionDate || "Election Day")
                              .replace(/\{\{pollHours\}\}/g, gotvPollHours || "7:00 AM - 8:00 PM")
                              .replace(/\{\{pollCloseTime\}\}/g, gotvPollHours?.split("-").pop()?.trim() || "8:00 PM")
                              .replace(/\{\{earlyVoteEnd\}\}/g, "the deadline")
                          )}
                        </div>
                        {mediaUrl && (
                          <div className="ml-auto max-w-[90%] w-fit">
                            {mediaUrl.match(/\.(mp4|3gp|3gpp)$/i) ? (
                              <div className="bg-muted-foreground/10 rounded-lg p-3 text-xs text-muted-foreground text-center">
                                [Video attachment]
                              </div>
                            ) : (
                              <img
                                src={mediaUrl}
                                alt="MMS preview"
                                className="max-h-32 rounded-lg border object-contain"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-muted-foreground/10 rounded-2xl px-3 py-6 text-sm text-muted-foreground text-center">
                        Your message will appear here...
                      </div>
                    )}
                  </div>
                </div>

                {/* Link tracking info */}
                {hasLinks && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
                    <p className="font-medium text-blue-700 mb-1">
                      {messageUrls.length} link{messageUrls.length !== 1 ? "s" : ""} detected — will be auto-shortened
                    </p>
                    <ul className="space-y-1 text-blue-600">
                      {messageUrls.map((url, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-blue-400 mt-px shrink-0">&#8226;</span>
                          <span className="break-all">{url}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-blue-500 mt-2">
                      Links will be replaced with trackable short URLs. Click stats appear in campaign analytics.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Test Message Modal */}
            {showTestModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-background rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Send Test Message</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send this message to a phone number for testing. Test messages count toward your balance.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="testPhone">Phone Number</Label>
                    <Input
                      id="testPhone"
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      autoFocus
                    />
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Message preview:</p>
                    <p className="whitespace-pre-wrap text-xs">{messageBody.slice(0, 200)}{messageBody.length > 200 ? "..." : ""}</p>
                    {mediaUrl && <p className="text-xs text-muted-foreground mt-1">+ MMS attachment</p>}
                  </div>
                  {testResult?.success && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                      {testResult.success}
                    </div>
                  )}
                  {testResult?.error && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                      {testResult.error}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setShowTestModal(false); setTestResult(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendTest}
                      disabled={!testPhone.trim() || testSending}
                    >
                      {testSending ? "Sending..." : "Send Test"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
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

            {/* GOTV Settings */}
            {type === "GOTV" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm">GOTV Settings</h4>
                <p className="text-xs text-muted-foreground">
                  Set default values for GOTV merge fields. These will be used when contact-specific data is not available.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gotvElectionDate">Election Date</Label>
                    <Input
                      id="gotvElectionDate"
                      type="date"
                      value={gotvElectionDate}
                      onChange={(e) => setGotvElectionDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gotvPollHours">Poll Hours</Label>
                    <Input
                      id="gotvPollHours"
                      value={gotvPollHours}
                      onChange={(e) => setGotvPollHours(e.target.value)}
                      placeholder="7:00 AM - 8:00 PM"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gotvDefaultLocation">Default Polling Location</Label>
                  <Input
                    id="gotvDefaultLocation"
                    value={gotvDefaultLocation}
                    onChange={(e) => setGotvDefaultLocation(e.target.value)}
                    placeholder="Check your local board of elections for your polling place"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used when a contact does not have a specific polling location assigned.
                  </p>
                </div>
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
