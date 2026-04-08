"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
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
import { PhonePreview } from "@/components/campaigns/phone-preview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createCampaignAction, sendTestMessageAction, getAllowedCampaignTypesAction } from "@/server/actions/campaigns";
import { listSegmentsAction } from "@/server/actions/contacts";
import { assignP2PContactsAction } from "@/server/actions/p2p";
import { getTeamMembersAction } from "@/server/actions/inbox";
import { listInterestListsAction } from "@/server/actions/interest-lists";
import { countSegments, hasUnicodeChars, getRemainingChars } from "@/lib/sms-utils";
import { DEFAULT_SMS_RATE_CENTS, DEFAULT_MMS_RATE_CENTS } from "@/lib/constants";

// Matches https://, http://, www., and bare domain URLs (e.g. google.com, example.org/path)
const URL_REGEX = /(?:https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:com|org|net|gov|edu|io|co|us|info|biz|me|app|dev|xyz|tv|ai|news|site|store|tech|online|shop|club|pro|page|link)(?:\/[^\s]*)?)/gi;

/**
 * Insert text at the current cursor position in a textarea.
 */
function insertAtCursor(textarea: HTMLTextAreaElement, text: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  // We need to use the native setter and dispatch an input event
  // so React's controlled state picks up the change.
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(textarea, before + text + after);
  } else {
    textarea.value = before + text + after;
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
}

const WIZARD_STEPS_DEFAULT = [
  { title: "Name & Type" },
  { title: "Audience" },
  { title: "Compose" },
  { title: "Schedule" },
  { title: "Review" },
];

const WIZARD_STEPS_P2P = [
  { title: "Name & Type" },
  { title: "Audience" },
  { title: "Script" },
  { title: "Assign Agents" },
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
    description: "Agents send messages one-by-one. FCC/TCPA compliant human-initiated texting.",
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

  // Interest list targeting
  const [interestLists, setInterestLists] = useState<any[]>([]);
  const [interestListMode, setInterestListMode] = useState<"" | "everyone" | "include" | "exclude">("");
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

  // P2P state
  const [p2pReplyScript, setP2pReplyScript] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  const WIZARD_STEPS = type === "P2P" ? WIZARD_STEPS_P2P : WIZARD_STEPS_DEFAULT;

  // Textarea ref for cursor-position merge field insertion
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showMergeDropdown, setShowMergeDropdown] = useState(false);
  const mergeDropdownRef = useRef<HTMLDivElement | null>(null);

  // Test message
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: string; error?: string } | null>(null);
  const testResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (testResultTimeoutRef.current) {
        clearTimeout(testResultTimeoutRef.current);
      }
    };
  }, []);

  // Close merge dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        mergeDropdownRef.current &&
        !mergeDropdownRef.current.contains(e.target as Node)
      ) {
        setShowMergeDropdown(false);
      }
    }
    if (showMergeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMergeDropdown]);

  /** Insert a merge field at the cursor position in the textarea */
  const handleInsertMergeField = useCallback((field: string) => {
    if (messageTextareaRef.current) {
      insertAtCursor(messageTextareaRef.current, field);
    } else {
      setMessageBody((prev) => prev + field);
    }
    setShowMergeDropdown(false);
  }, []);

  useEffect(() => {
    loadSegments();
    loadAllowedTypes();
    loadTeamMembers();
    loadInterestLists();
  }, []);

  async function loadTeamMembers() {
    try {
      const members = await getTeamMembersAction();
      setTeamMembers(members.filter((m: any) =>
        ["OWNER", "ADMIN", "MANAGER", "SENDER"].includes(m.role)
      ));
    } catch {}
  }

  async function loadInterestLists() {
    try {
      const data = await listInterestListsAction();
      setInterestLists(data.filter((l: any) => l.isActive));
    } catch {}
  }

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
        if (type === "AUTO_REPLY") return true;
        if (interestListMode === "everyone") return true;
        if (interestListMode === "include" && selectedListIds.length > 0) return true;
        if (interestListMode === "exclude" && selectedListIds.length > 0) return true;
        return !!segmentId;
      case 2:
        return !!messageBody;
      case 3:
        if (type === "P2P") return selectedAgents.length > 0;
        return scheduleType === "now" || !!scheduledAt;
      case 4:
        if (type === "P2P") return scheduleType === "now" || !!scheduledAt;
        return true;
      default:
        return true;
    }
  }

  async function handleSaveDraft() {
    if (!name || !type) return;
    setLoading(true);
    setError("");

    try {
      const campaign = await createCampaignAction({
        name,
        type: type as any,
        segmentId: segmentId || undefined,
        messageBody: messageBody || "Draft — message not yet written",
        mediaUrl: mediaUrl || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        ...(interestListMode && {
          interestListMode,
          interestListIds: selectedListIds.length > 0 ? selectedListIds : undefined,
        }),
        ...(type === "GOTV" && gotvElectionDate && {
          gotvSettings: {
            electionDate: gotvElectionDate || undefined,
            pollHours: gotvPollHours || undefined,
            defaultPollingLocation: gotvDefaultLocation || undefined,
          },
        }),
        ...(type === "P2P" && {
          p2pScript: messageBody || undefined,
          p2pReplyScript: p2pReplyScript || undefined,
        }),
      });

      // For P2P campaigns, assign contacts to agents if selected
      if (type === "P2P" && selectedAgents.length > 0) {
        await assignP2PContactsAction(campaign.id, selectedAgents);
      }

      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to save draft");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setLoading(true);
    setError("");

    try {
      const isP2PScheduled = type === "P2P" && scheduleType === "later" && scheduledAt;

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
        ...(interestListMode && {
          interestListMode,
          interestListIds: selectedListIds.length > 0 ? selectedListIds : undefined,
        }),
        ...(type === "GOTV" && {
          gotvSettings: {
            electionDate: gotvElectionDate || undefined,
            pollHours: gotvPollHours || undefined,
            defaultPollingLocation: gotvDefaultLocation || undefined,
          },
        }),
        ...(type === "P2P" && {
          p2pScript: messageBody,
          p2pReplyScript: p2pReplyScript || undefined,
        }),
      });

      // For P2P campaigns, assign contacts to agents immediately
      // (they'll be ready when the campaign launches, whether now or scheduled)
      if (type === "P2P" && selectedAgents.length > 0) {
        await assignP2PContactsAction(campaign.id, selectedAgents);
      }

      // If P2P is scheduled for later, transition to SCHEDULED status
      if (isP2PScheduled) {
        const { changeCampaignStatusAction } = await import("@/server/actions/campaigns");
        await changeCampaignStatusAction(campaign.id, "SCHEDULED");
      }

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
      if (testResultTimeoutRef.current) {
        clearTimeout(testResultTimeoutRef.current);
      }
      testResultTimeoutRef.current = setTimeout(() => {
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {/* Targeting Mode */}
                <div className="space-y-2">
                  <Label>Targeting Method *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        !interestListMode && segmentId ? "border-primary bg-primary/5" : !interestListMode ? "border-primary bg-primary/5" : "hover:border-primary/50"
                      }`}
                      onClick={() => { setInterestListMode(""); setSelectedListIds([]); }}
                    >
                      <p className="font-medium text-sm">Segment</p>
                      <p className="text-xs text-muted-foreground mt-1">Use saved contact segments</p>
                    </div>
                    <div
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        interestListMode === "everyone" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                      }`}
                      onClick={() => { setInterestListMode("everyone"); setSegmentId(""); }}
                    >
                      <p className="font-medium text-sm">Everyone</p>
                      <p className="text-xs text-muted-foreground mt-1">All opted-in contacts</p>
                    </div>
                    <div
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        interestListMode === "include" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                      }`}
                      onClick={() => { setInterestListMode("include"); setSegmentId(""); }}
                    >
                      <p className="font-medium text-sm">Interest Lists (Include)</p>
                      <p className="text-xs text-muted-foreground mt-1">Only contacts ON selected lists</p>
                    </div>
                    <div
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        interestListMode === "exclude" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                      }`}
                      onClick={() => { setInterestListMode("exclude"); setSegmentId(""); }}
                    >
                      <p className="font-medium text-sm">Interest Lists (Exclude)</p>
                      <p className="text-xs text-muted-foreground mt-1">All contacts EXCEPT those on selected lists</p>
                    </div>
                  </div>
                </div>

                {/* Segment Picker (when segment mode) */}
                {!interestListMode && (
                  <>
                    <div className="space-y-2">
                      <Label>Segment *</Label>
                      <NativeSelect
                        value={segmentId}
                        onChange={(e) => setSegmentId(e.target.value)}
                      >
                        <option value="">Select a segment...</option>
                        {segments.map((seg) => (
                          <option key={seg.id} value={seg.id}>
                            {seg.name} ({seg.contactCount} contacts)
                          </option>
                        ))}
                      </NativeSelect>
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
                      <div className="rounded-md bg-warning/10 border border-warning/30 p-4 text-sm text-warning">
                        No segments found. Create a segment in{" "}
                        <a href="/contacts/segments" className="underline">
                          Contacts &gt; Segments
                        </a>{" "}
                        first.
                      </div>
                    )}
                  </>
                )}

                {/* Interest List Picker (when include/exclude mode) */}
                {(interestListMode === "include" || interestListMode === "exclude") && (
                  <div className="space-y-3">
                    <Label>
                      {interestListMode === "include"
                        ? "Select lists to include (contacts on ANY of these lists)"
                        : "Select lists to exclude (contacts NOT on these lists)"}
                    </Label>
                    {interestLists.length === 0 ? (
                      <div className="rounded-md bg-warning/10 border border-warning/30 p-4 text-sm text-warning">
                        No active interest lists found. Create one in{" "}
                        <a href="/interest-lists" className="underline">Interest Lists</a> first.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {interestLists.map((list: any) => {
                          const isSelected = selectedListIds.includes(list.id);
                          const memberCount = list._count?.members ?? list.memberCount ?? 0;
                          return (
                            <div
                              key={list.id}
                              className={`border rounded-lg p-3 cursor-pointer transition-colors flex items-center justify-between ${
                                isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                              }`}
                              onClick={() => {
                                setSelectedListIds((prev) =>
                                  isSelected ? prev.filter((id) => id !== list.id) : [...prev, list.id]
                                );
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={isSelected} readOnly className="rounded" />
                                <div>
                                  <p className="text-sm font-medium">{list.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Keyword: <span className="font-mono">{list.keyword}</span>
                                  </p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {memberCount} member{memberCount !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedListIds.length > 0 && (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <p>
                          <strong>{selectedListIds.length}</strong> list{selectedListIds.length !== 1 ? "s" : ""} selected.
                          {interestListMode === "include"
                            ? " Contacts on multiple lists will only receive the message once."
                            : " Contacts on any of these lists will be excluded."}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* "Everyone" confirmation */}
                {interestListMode === "everyone" && (
                  <div className="rounded-md bg-info/10 border border-info/20 p-4 text-sm text-info">
                    This campaign will be sent to <strong>all opted-in contacts</strong> in your organization.
                    Opted-out contacts are always excluded automatically.
                  </div>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSaveDraft} disabled={loading} className="text-muted-foreground">
                {loading ? "Saving..." : "Save as Draft"}
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canProceed()}>
                Next: Compose
              </Button>
            </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

            {/* Two-column layout: Composer + Phone Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-6 items-start">
              {/* Left column: Composer */}
              <div className="space-y-4 min-w-0">
                <div className="space-y-2">
                  <Label>Message Body *</Label>
                  <Textarea
                    ref={messageTextareaRef}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder={type === "GOTV" ? "Hi {{firstName}}, Election Day is tomorrow! Your polling place is {{pollingLocation}}..." : "Hi {{firstName}}, early voting starts tomorrow! Find your polling location at..."}
                    rows={6}
                  />

                  {/* Composer Toolbar */}
                  <div className="flex items-center justify-between gap-2 rounded-lg border p-2">
                    <div className="flex items-center gap-3 text-sm">
                      {/* Character / Segment counter */}
                      <span className="text-muted-foreground tabular-nums">
                        {charCount}/{isUnicode ? "70" : "160"}
                      </span>
                      <span className="text-muted-foreground/50">&middot;</span>
                      <span
                        className={`font-medium tabular-nums ${
                          segmentCount > 3
                            ? "text-orange-500"
                            : segmentCount > 1
                              ? "text-yellow-500"
                              : "text-green-500"
                        }`}
                      >
                        {segmentCount} segment{segmentCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-muted-foreground/50">&middot;</span>
                      <span className="text-muted-foreground text-xs">
                        {remaining} left
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Merge fields dropdown */}
                      <div className="relative" ref={mergeDropdownRef}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setShowMergeDropdown((v) => !v)}
                        >
                          <span className="font-mono text-xs">{"{+"}</span>
                          Merge Fields
                        </Button>
                        {showMergeDropdown && (
                          <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-lg border bg-popover shadow-lg p-1">
                            {[
                              { label: "First Name", value: "{{firstName}}" },
                              { label: "Last Name", value: "{{lastName}}" },
                              { label: "Full Name", value: "{{fullName}}" },
                              { label: "Prefix", value: "{{prefix}}" },
                              { label: "Suffix", value: "{{suffix}}" },
                              { label: "Phone", value: "{{phone}}" },
                              { label: "Address", value: "{{address}}" },
                              { label: "Precinct", value: "{{precinct}}" },
                              { label: "Org Name", value: "{{orgName}}" },
                              ...(type === "GOTV"
                                ? [
                                    { label: "Polling Location", value: "{{pollingLocation}}" },
                                    { label: "Election Date", value: "{{electionDate}}" },
                                    { label: "Poll Hours", value: "{{pollHours}}" },
                                    { label: "Poll Close Time", value: "{{pollCloseTime}}" },
                                    { label: "Early Vote End", value: "{{earlyVoteEnd}}" },
                                  ]
                                : []),
                            ].map((field) => (
                              <button
                                key={field.value}
                                type="button"
                                className="w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-accent transition-colors flex items-center justify-between"
                                onClick={() => handleInsertMergeField(field.value)}
                              >
                                <span>{field.label}</span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {field.value}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Cost per recipient */}
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {(costPerRecipientCents / 100).toFixed(2)}&#162;/msg
                      </span>
                    </div>
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
                    <p className="text-xs text-warning">
                      Unicode detected (emoji or special characters). Segment limit reduced from 160 to 70 characters.
                    </p>
                  )}
                  {segmentCount > 3 && (
                    <p className="text-xs text-warning">
                      Long messages cost more. Consider shortening to reduce per-recipient cost.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>MMS Media (optional)</Label>
                  <MediaUpload
                    value={mediaUrl}
                    onUpload={(url) => setMediaUrl(url)}
                    onRemove={() => setMediaUrl("")}
                  />
                </div>

                {/* Link tracking info */}
                {hasLinks && (
                  <div className="rounded-lg border border-info/30 bg-info/10 p-3 text-xs">
                    <p className="font-medium text-info mb-1">
                      {messageUrls.length} link{messageUrls.length !== 1 ? "s" : ""} detected — will be auto-shortened
                    </p>
                    <ul className="space-y-1 text-info">
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

              {/* Right column: Phone Preview */}
              <div className="hidden lg:block sticky top-6">
                <div className="flex items-center justify-between mb-3">
                  <Label>Live Preview</Label>
                  {messageBody && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTestModal(true)}
                    >
                      Send Test
                    </Button>
                  )}
                </div>
                <PhonePreview
                  message={messageBody}
                  mediaUrl={mediaUrl || undefined}
                  orgName="CivicText"
                  showSendTest
                  mergeOverrides={{
                    "{{pollingLocation}}": gotvDefaultLocation || "Your local polling place",
                    "{{electionDate}}": gotvElectionDate || "Election Day",
                    "{{pollHours}}": gotvPollHours || "7:00 AM - 8:00 PM",
                    "{{pollCloseTime}}": gotvPollHours?.split("-").pop()?.trim() || "8:00 PM",
                  }}
                />
              </div>
            </div>

            {/* Mobile-only: Send Test button (phone preview only shows on lg+) */}
            <div className="lg:hidden">
              {messageBody && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowTestModal(true)}
                >
                  Send Test Message
                </Button>
              )}
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
                    <div className="rounded-md bg-success/10 border border-success/30 p-3 text-sm text-success">
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
            {/* P2P Reply Script */}
            {type === "P2P" && (
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="p2pReplyScript">Suggested Reply Script (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  When a contact replies, agents will see this suggested response. Leave blank if not needed.
                </p>
                <Textarea
                  id="p2pReplyScript"
                  value={p2pReplyScript}
                  onChange={(e) => setP2pReplyScript(e.target.value)}
                  placeholder="Thanks for your response, {{firstName}}! ..."
                  rows={3}
                />
              </div>
            )}

            {type === "P2P" && (
              <div className="rounded-lg bg-info/10 border border-info/20 p-3 text-sm text-info">
                <p className="font-medium">P2P Mode</p>
                <p className="text-xs mt-1">
                  Agents can personalize each message before sending. Every send requires a human action (click or keystroke) for FCC/TCPA compliance.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSaveDraft} disabled={loading} className="text-muted-foreground">
                {loading ? "Saving..." : "Save as Draft"}
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceed()}>
                {type === "P2P" ? "Next: Assign Agents" : "Next: Schedule"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Assign Agents (P2P) or Schedule */}
      {step === 3 && type === "P2P" && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Agents</CardTitle>
            <CardDescription>
              Select team members who will send messages. Contacts will be distributed evenly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Select Agents</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedAgents.length === teamMembers.length) {
                    setSelectedAgents([]);
                  } else {
                    setSelectedAgents(teamMembers.map((m: any) => m.id));
                  }
                }}
              >
                {selectedAgents.length === teamMembers.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            {teamMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No team members with sending permissions found.</p>
                <p className="text-xs mt-1">Add team members with the Sender role or higher.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teamMembers.map((member: any) => {
                  const isSelected = selectedAgents.includes(member.id);
                  return (
                    <div
                      key={member.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setSelectedAgents((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== member.id)
                            : [...prev, member.id]
                        );
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded"
                        />
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedAgents.length > 0 && selectedSegment && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p>
                  <strong>{selectedSegment.contactCount?.toLocaleString()}</strong> contacts &divide;{" "}
                  <strong>{selectedAgents.length}</strong> agent{selectedAgents.length !== 1 ? "s" : ""} ={" "}
                  <strong>~{Math.ceil((selectedSegment.contactCount || 0) / selectedAgents.length)}</strong> contacts each
                </p>
              </div>
            )}

            <div className="rounded-lg bg-info/10 border border-info/20 p-3 text-xs text-info">
              Agents will be able to start sending once you launch the campaign. No messages will be sent until agents begin from their queues.
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSaveDraft} disabled={loading} className="text-muted-foreground">
                {loading ? "Saving..." : "Save as Draft"}
              </Button>
              <Button onClick={() => setStep(4)} disabled={!canProceed()}>
                Next: Schedule
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Schedule (P2P) */}
      {step === 4 && type === "P2P" && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Launch</CardTitle>
            <CardDescription>
              Choose when agents can start sending. Contacts are already assigned and will be waiting in their queues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  scheduleType === "now"
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => { setScheduleType("now"); setScheduledAt(""); }}
              >
                <p className="font-medium text-sm">Launch Now</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Agents can begin sending immediately after you create the campaign.
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
                  The campaign will automatically open for agents at the scheduled time.
                </p>
              </div>
            </div>

            {scheduleType === "later" && (
              <div className="space-y-2">
                <Label htmlFor="p2pScheduledAt">Launch Date & Time *</Label>
                <Input
                  id="p2pScheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Agents will not be able to send messages until this time. The campaign will automatically transition to &ldquo;Sending&rdquo; when ready.
                </p>
              </div>
            )}

            <div className="rounded-lg bg-info/10 border border-info/20 p-3 text-xs text-info">
              <p className="font-medium mb-1">How scheduled P2P works:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Contacts are pre-assigned to agents when you create the campaign</li>
                <li>The campaign stays in &ldquo;Scheduled&rdquo; status until the launch time</li>
                <li>At the scheduled time, it automatically opens for sending</li>
                <li>Agents then send messages one-by-one from their queues</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSaveDraft} disabled={loading} className="text-muted-foreground">
                {loading ? "Saving..." : "Save as Draft"}
              </Button>
              <Button onClick={() => setStep(5)} disabled={!canProceed()}>
                Next: Review
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {step === 3 && type !== "P2P" && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>
              Choose when to send this campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSaveDraft} disabled={loading} className="text-muted-foreground">
                {loading ? "Saving..." : "Save as Draft"}
              </Button>
              <Button onClick={() => setStep(4)} disabled={!canProceed()}>
                Next: Review
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Review Step (step 4 for non-P2P, step 5 for P2P) */}
      {step === (type === "P2P" ? 5 : 4) && (
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
                  : interestListMode === "everyone"
                    ? "All opted-in contacts"
                    : interestListMode === "include"
                      ? `${selectedListIds.length} interest list${selectedListIds.length !== 1 ? "s" : ""} (include)`
                      : interestListMode === "exclude"
                        ? `All contacts except ${selectedListIds.length} list${selectedListIds.length !== 1 ? "s" : ""}`
                        : selectedSegment
                          ? `${selectedSegment.name} (${selectedSegment.contactCount} contacts)`
                          : "No segment"}
              </dd>

              <dt className="text-muted-foreground">
                {type === "P2P" ? "Agents" : "Schedule"}
              </dt>
              <dd>
                {type === "P2P"
                  ? `${selectedAgents.length} agent${selectedAgents.length !== 1 ? "s" : ""} assigned`
                  : scheduleType === "now"
                    ? "Send immediately"
                    : new Date(scheduledAt).toLocaleString()}
              </dd>

              {type === "P2P" && (
                <>
                  <dt className="text-muted-foreground">Launch</dt>
                  <dd>
                    {scheduleType === "now"
                      ? "Agents can begin sending immediately"
                      : `Scheduled for ${new Date(scheduledAt).toLocaleString()}`}
                  </dd>
                </>
              )}

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
            <Button variant="outline" onClick={() => setStep(type === "P2P" ? 4 : 3)}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSaveDraft} disabled={loading} className="text-muted-foreground">
                Save as Draft
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading
                  ? "Creating..."
                  : type === "P2P"
                    ? scheduleType === "later"
                      ? "Create & Schedule P2P Campaign"
                      : "Launch P2P Campaign"
                    : scheduleType === "now"
                      ? "Create & Send Now"
                      : "Create & Schedule"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
