"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";
import {
  getCampaignAction,
  updateCampaignAction,
  changeCampaignStatusAction,
} from "@/server/actions/campaigns";
import { listSegmentsAction } from "@/server/actions/contacts";
import { assignP2PContactsAction } from "@/server/actions/p2p";
import { getTeamMembersAction } from "@/server/actions/inbox";
import { listInterestListsAction } from "@/server/actions/interest-lists";
import { listPollingLocationsAction } from "@/server/actions/polling-locations";
import { countSegments } from "@/lib/sms-utils";
import { formatTime } from "@/lib/date-utils";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";

/**
 * Insert text at the current cursor position in a textarea.
 */
function insertAtCursor(textarea: HTMLTextAreaElement, text: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  // M-17: Safe setter with null check
  const newValue = before + text + after;
  if (nativeSetter) {
    nativeSetter.call(textarea, newValue);
  } else {
    textarea.value = newValue;
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
}

const WIZARD_STEPS_DEFAULT = [
  { title: "Details" },
  { title: "Audience" },
  { title: "Compose" },
  { title: "Schedule" },
];

const WIZARD_STEPS_P2P = [
  { title: "Details" },
  { title: "Audience" },
  { title: "Script" },
  { title: "Assign Agents" },
  { title: "Schedule" },
];

interface EditCampaignData {
  id: string;
  name: string;
  type: string;
  status: string;
  messageBody: string;
  mediaUrl: string | null;
  segmentId: string | null;
  scheduledAt: Date | string | null;
  interestListMode: string | null;
  interestListIds: string[];
  p2pReplyScript: string | null;
}

interface SegmentOption {
  id: string;
  name: string;
  contactCount: number;
}

interface InterestListOption {
  id: string;
  name: string;
  keyword: string;
  isActive: boolean;
  _count?: { members: number };
  memberCount?: number;
}

interface TeamMemberOption {
  id: string;
  name: string;
  role: string;
}

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState<EditCampaignData | null>(null);

  // Data
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [interestLists, setInterestLists] = useState<InterestListOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [interestListMode, setInterestListMode] = useState<"" | "everyone" | "include" | "exclude">("");
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [p2pReplyScript, setP2pReplyScript] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // GOTV settings
  const [gotvElectionDate, setGotvElectionDate] = useState("");
  const [gotvEarlyVoteEnd, setGotvEarlyVoteEnd] = useState("");
  const [gotvPollOpen, setGotvPollOpen] = useState("07:00");
  const [gotvPollClose, setGotvPollClose] = useState("20:00");
  const [gotvDefaultLocation, setGotvDefaultLocation] = useState("");
  const [pollingLocationCount, setPollingLocationCount] = useState(0);

  const WIZARD_STEPS = type === "P2P" ? WIZARD_STEPS_P2P : WIZARD_STEPS_DEFAULT;
  const segmentCount = countSegments(messageBody);

  // Merge field insertion
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showMergeDropdown, setShowMergeDropdown] = useState(false);
  const mergeDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mergeDropdownRef.current && !mergeDropdownRef.current.contains(e.target as Node)) {
        setShowMergeDropdown(false);
      }
    }
    if (showMergeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMergeDropdown]);

  const handleInsertMergeField = useCallback((field: string) => {
    if (messageTextareaRef.current) {
      insertAtCursor(messageTextareaRef.current, field);
    } else {
      setMessageBody((prev) => prev + field);
    }
    setShowMergeDropdown(false);
  }, []);

  const loadAll = useCallback(async () => {
    setPageLoading(true);
    try {
      const [campaignData, segmentData, listData, memberData] = await Promise.all([
        getCampaignAction(campaignId),
        listSegmentsAction(),
        listInterestListsAction(),
        getTeamMembersAction(),
      ]);

      if (!campaignData) {
        router.push("/campaigns");
        return;
      }
      if (campaignData.status !== "DRAFT") {
        toast.error("Only draft campaigns can be edited");
        router.push(`/campaigns/${campaignId}`);
        return;
      }

      setCampaign(campaignData);
      setSegments(segmentData);
      setInterestLists(listData.filter((l: any) => l.isActive));
      setTeamMembers(memberData.filter((m: any) =>
        ["OWNER", "ADMIN", "MANAGER", "SENDER"].includes(m.role)
      ));

      // Pre-populate form
      setName(campaignData.name || "");
      setType(campaignData.type || "");
      setSegmentId(campaignData.segmentId || "");
      setMessageBody(campaignData.messageBody || "");
      setMediaUrl(campaignData.mediaUrl || "");
      setP2pReplyScript(campaignData.p2pReplyScript || "");
      setInterestListMode((campaignData.interestListMode as "" | "everyone" | "include" | "exclude") || "");
      setSelectedListIds(campaignData.interestListIds || []);

      if (campaignData.scheduledAt) {
        setScheduleType("later");
        const d = new Date(campaignData.scheduledAt);
        setScheduledAt(d.toISOString().slice(0, 16));
      }

      // Pre-populate GOTV settings from campaign.settings JSON
      if (campaignData.type === "GOTV" && campaignData.settings) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gotv = (campaignData.settings as any)?.gotv;
        if (gotv) {
          setGotvElectionDate(gotv.electionDate || "");
          setGotvEarlyVoteEnd(gotv.earlyVoteEnd || "");
          setGotvPollOpen(gotv.pollOpenTime || "07:00");
          setGotvPollClose(gotv.pollCloseTime || "20:00");
          setGotvDefaultLocation(gotv.defaultPollingLocation || "");
        }
        listPollingLocationsAction(1, 1)
          .then((r) => setPollingLocationCount(r.total))
          .catch(() => setPollingLocationCount(0));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load campaign");
    } finally {
      setPageLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await updateCampaignAction({
        id: campaignId,
        name,
        messageBody,
        mediaUrl: mediaUrl || undefined,
        segmentId: segmentId || undefined,
        scheduledAt: scheduleType === "later" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
        interestListMode: interestListMode || undefined,
        interestListIds: selectedListIds.length > 0 ? selectedListIds : undefined,
        p2pScript: type === "P2P" ? messageBody : undefined,
        p2pReplyScript: type === "P2P" ? p2pReplyScript || undefined : undefined,
        ...(type === "GOTV" && {
          gotvSettings: {
            electionDate: gotvElectionDate || undefined,
            earlyVoteEnd: gotvEarlyVoteEnd || undefined,
            pollOpenTime: gotvPollOpen || undefined,
            pollCloseTime: gotvPollClose || undefined,
            defaultPollingLocation: gotvDefaultLocation || undefined,
          },
        }),
      });

      // For P2P, re-assign agents if changed
      if (type === "P2P" && selectedAgents.length > 0) {
        await assignP2PContactsAction(campaignId, selectedAgents);
      }

      toast.success("Campaign saved");
      router.push(`/campaigns/${campaignId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndLaunch() {
    setSaving(true);
    setError("");
    try {
      await updateCampaignAction({
        id: campaignId,
        name,
        messageBody,
        mediaUrl: mediaUrl || undefined,
        segmentId: segmentId || undefined,
        scheduledAt: scheduleType === "later" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
        interestListMode: interestListMode || undefined,
        interestListIds: selectedListIds.length > 0 ? selectedListIds : undefined,
        p2pScript: type === "P2P" ? messageBody : undefined,
        p2pReplyScript: type === "P2P" ? p2pReplyScript || undefined : undefined,
        ...(type === "GOTV" && {
          gotvSettings: {
            electionDate: gotvElectionDate || undefined,
            earlyVoteEnd: gotvEarlyVoteEnd || undefined,
            pollOpenTime: gotvPollOpen || undefined,
            pollCloseTime: gotvPollClose || undefined,
            defaultPollingLocation: gotvDefaultLocation || undefined,
          },
        }),
      });

      if (type === "P2P" && selectedAgents.length > 0) {
        await assignP2PContactsAction(campaignId, selectedAgents);
      }

      if (scheduleType === "later" && scheduledAt) {
        await changeCampaignStatusAction(campaignId, "SCHEDULED");
        toast.success("Campaign scheduled");
      } else {
        await changeCampaignStatusAction(campaignId, "SENDING");
        toast.success("Campaign launched");
      }

      router.push(`/campaigns/${campaignId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to launch campaign");
    } finally {
      setSaving(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-4 w-80" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/campaigns/${campaignId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Campaign</h1>
          <p className="text-muted-foreground">
            Modify your draft campaign. Save changes or launch when ready.
          </p>
        </div>
      </div>

      <Steps steps={WIZARD_STEPS} currentStep={step} />

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step 0: Details */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Update the campaign name. Type cannot be changed after creation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Campaign Type</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{type}</Badge>
                <span className="text-xs text-muted-foreground">Type cannot be changed after creation</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => router.push(`/campaigns/${campaignId}`)}>Cancel</Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSave} disabled={saving} className="text-muted-foreground">
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button onClick={() => setStep(1)} disabled={!name}>Next: Audience</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Step 1: Audience */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Audience</CardTitle>
            <CardDescription>Choose who receives this campaign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {type === "AUTO_REPLY" ? (
              <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                Auto-reply campaigns respond to keywords from any contact. No audience selection is needed.
              </div>
            ) : (
              <>
                {/* Targeting Mode */}
                <div className="space-y-2">
                  <Label>Targeting Method</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { mode: "" as const, label: "Segment", desc: "Use saved contact segments" },
                      { mode: "everyone" as const, label: "Everyone", desc: "All opted-in contacts" },
                      { mode: "include" as const, label: "Interest Lists (Include)", desc: "Only contacts ON selected lists" },
                      { mode: "exclude" as const, label: "Interest Lists (Exclude)", desc: "All contacts EXCEPT those on selected lists" },
                    ].map((opt) => (
                      <div
                        key={opt.mode || "segment"}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          interestListMode === opt.mode ? "border-primary bg-primary/5" : "hover:border-primary/50"
                        }`}
                        onClick={() => {
                          setInterestListMode(opt.mode);
                          if (opt.mode) setSegmentId("");
                          if (opt.mode !== "include" && opt.mode !== "exclude") setSelectedListIds([]);
                        }}
                      >
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Segment Picker */}
                {!interestListMode && (
                  <div className="space-y-2">
                    <Label>Segment</Label>
                    <NativeSelect value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                      <option value="">Select a segment...</option>
                      {segments.map((seg) => (
                        <option key={seg.id} value={seg.id}>{seg.name} ({seg.contactCount} contacts)</option>
                      ))}
                    </NativeSelect>
                  </div>
                )}

                {/* Interest List Picker */}
                {(interestListMode === "include" || interestListMode === "exclude") && (
                  <div className="space-y-2">
                    <Label>{interestListMode === "include" ? "Include contacts on these lists" : "Exclude contacts on these lists"}</Label>
                    {interestLists.map((list: any) => {
                      const isSelected = selectedListIds.includes(list.id);
                      const count = list._count?.members ?? list.memberCount ?? 0;
                      return (
                        <div
                          key={list.id}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors flex items-center justify-between ${
                            isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedListIds((prev) =>
                            isSelected ? prev.filter((id) => id !== list.id) : [...prev, list.id]
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={isSelected} readOnly className="rounded" />
                            <div>
                              <p className="text-sm font-medium">{list.name}</p>
                              <p className="text-xs text-muted-foreground">Keyword: <span className="font-mono">{list.keyword}</span></p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}

                {interestListMode === "everyone" && (
                  <div className="rounded-md bg-info/10 border border-info/20 p-4 text-sm text-info">
                    This campaign will target all opted-in contacts.
                  </div>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSave} disabled={saving} className="text-muted-foreground">
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button onClick={() => setStep(2)}>Next: {type === "P2P" ? "Script" : "Compose"}</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Compose / Script */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle>{type === "P2P" ? "P2P Script" : "Compose Message"}</CardTitle>
              <CardDescription>
                Write your message. Use {"{{firstName}}"}, {"{{lastName}}"}, or {"{{orgName}}"} for personalization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Message Body</Label>
                <Textarea
                  ref={messageTextareaRef}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={6}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{messageBody.length} chars</span>
                    <span>{segmentCount} segment{segmentCount !== 1 ? "s" : ""}</span>
                  </div>
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
                </div>
              </div>

              <div className="space-y-2">
                <Label>MMS Attachment (Optional)</Label>
                <MediaUpload
                  value={mediaUrl}
                  onUpload={(url) => setMediaUrl(url)}
                  onRemove={() => setMediaUrl("")}
                />
              </div>

              {type === "P2P" && (
                <div className="space-y-2 border-t pt-4">
                  <Label>Suggested Reply Script (Optional)</Label>
                  <Textarea
                    value={p2pReplyScript}
                    onChange={(e) => setP2pReplyScript(e.target.value)}
                    placeholder="Thanks for your response, {{firstName}}!"
                    rows={3}
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleSave} disabled={saving} className="text-muted-foreground">
                  {saving ? "Saving..." : "Save Draft"}
                </Button>
                <Button onClick={() => setStep(3)} disabled={!messageBody.trim()}>
                  Next: {type === "P2P" ? "Assign Agents" : "Schedule"}
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* Live Phone Preview — desktop (side column) */}
          <div className="hidden lg:block sticky top-6">
            <PhonePreview
              message={messageBody}
              mediaUrl={mediaUrl || undefined}
              showSendTest
              mergeOverrides={type === "GOTV" ? {
                "{{pollingLocation}}": gotvDefaultLocation || "Your local polling place",
                "{{electionDate}}": gotvElectionDate
                  ? new Date(gotvElectionDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                  : "Election Day",
                "{{pollHours}}": gotvPollOpen && gotvPollClose
                  ? `${formatTime(gotvPollOpen)} - ${formatTime(gotvPollClose)}`
                  : "7:00 AM - 8:00 PM",
                "{{pollCloseTime}}": gotvPollClose ? formatTime(gotvPollClose) : "8:00 PM",
                "{{earlyVoteEnd}}": gotvEarlyVoteEnd
                  ? new Date(gotvEarlyVoteEnd + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                  : "",
              } : undefined}
            />
          </div>

          {/* Live Phone Preview — mobile (below form) */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-medium">Live Preview</Label>
            </div>
            <PhonePreview
              message={messageBody}
              mediaUrl={mediaUrl || undefined}
              showSendTest
              mergeOverrides={type === "GOTV" ? {
                "{{pollingLocation}}": gotvDefaultLocation || "Your local polling place",
                "{{electionDate}}": gotvElectionDate
                  ? new Date(gotvElectionDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                  : "Election Day",
                "{{pollHours}}": gotvPollOpen && gotvPollClose
                  ? `${formatTime(gotvPollOpen)} - ${formatTime(gotvPollClose)}`
                  : "7:00 AM - 8:00 PM",
                "{{pollCloseTime}}": gotvPollClose ? formatTime(gotvPollClose) : "8:00 PM",
                "{{earlyVoteEnd}}": gotvEarlyVoteEnd
                  ? new Date(gotvEarlyVoteEnd + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                  : "",
              } : undefined}
            />
          </div>
        </div>
      )}

      {/* Step 3: Assign Agents (P2P only) */}
      {step === 3 && type === "P2P" && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Agents</CardTitle>
            <CardDescription>Select team members who will send messages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Select Agents</Label>
              <Button variant="ghost" size="sm" onClick={() =>
                setSelectedAgents(selectedAgents.length === teamMembers.length ? [] : teamMembers.map((m: any) => m.id))
              }>
                {selectedAgents.length === teamMembers.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teamMembers.map((member: any) => {
                const isSelected = selectedAgents.includes(member.id);
                return (
                  <div
                    key={member.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedAgents((prev) =>
                      isSelected ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={isSelected} readOnly className="rounded" />
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSave} disabled={saving} className="text-muted-foreground">
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button onClick={() => setStep(4)}>Next: Schedule</Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Schedule Step (step 3 for non-P2P, step 4 for P2P) */}
      {step === (type === "P2P" ? 4 : 3) && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Choose when to launch this campaign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  scheduleType === "now" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                }`}
                onClick={() => { setScheduleType("now"); setScheduledAt(""); }}
              >
                <p className="font-medium text-sm">{type === "P2P" ? "Launch Now" : "Send Now"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {type === "P2P" ? "Agents can begin sending immediately." : "Start sending immediately."}
                </p>
              </div>
              <div
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  scheduleType === "later" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                }`}
                onClick={() => setScheduleType("later")}
              >
                <p className="font-medium text-sm">Schedule for Later</p>
                <p className="text-xs text-muted-foreground mt-1">Pick a date and time.</p>
              </div>
            </div>

            {scheduleType === "later" && (
              <div className="space-y-2">
                <Label>Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            )}

            {/* GOTV Settings */}
            {type === "GOTV" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm">GOTV Campaign Settings</h4>
                <p className="text-xs text-muted-foreground">
                  Configure election details. Contacts with a precinct number will automatically receive their specific polling location from your Polling Location directory.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gotvElectionDate">Election Date *</Label>
                    <Input id="gotvElectionDate" type="date" value={gotvElectionDate} onChange={(e) => setGotvElectionDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gotvEarlyVoteEnd">Early Voting Ends</Label>
                    <Input id="gotvEarlyVoteEnd" type="date" value={gotvEarlyVoteEnd} onChange={(e) => setGotvEarlyVoteEnd(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{"Used by the {{earlyVoteEnd}} merge field"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gotvPollOpen">Polls Open (default)</Label>
                    <Input id="gotvPollOpen" type="time" value={gotvPollOpen} onChange={(e) => setGotvPollOpen(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Overridden per-precinct if set in Polling Locations</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gotvPollClose">Polls Close (default)</Label>
                    <Input id="gotvPollClose" type="time" value={gotvPollClose} onChange={(e) => setGotvPollClose(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Overridden per-precinct if set in Polling Locations</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gotvDefaultLocation">Default Polling Location</Label>
                  <Input id="gotvDefaultLocation" value={gotvDefaultLocation} onChange={(e) => setGotvDefaultLocation(e.target.value)} placeholder="Check your local board of elections for your polling place" />
                  <p className="text-xs text-muted-foreground">Used when a contact has no precinct or no matching entry in Polling Locations.</p>
                </div>
                <div className="flex items-center gap-2 p-3 border rounded bg-background">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Polling Location Directory: <strong>{pollingLocationCount}</strong> precinct{pollingLocationCount !== 1 ? "s" : ""} configured</span>
                  <Link href="/polling-locations" className="text-sm text-primary hover:underline ml-auto">Manage Polling Locations &rarr;</Link>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(type === "P2P" ? 3 : 2)}>Back</Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSave} disabled={saving} className="text-muted-foreground">
                Save Draft
              </Button>
              <Button onClick={handleSaveAndLaunch} disabled={saving || (scheduleType === "later" && !scheduledAt)}>
                {saving
                  ? "Saving..."
                  : scheduleType === "later"
                    ? "Save & Schedule"
                    : type === "P2P"
                      ? "Save & Launch"
                      : "Save & Send Now"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
