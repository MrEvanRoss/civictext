"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { countSegments } from "@/lib/sms-utils";
import { P2P_PREFETCH_COUNT, P2P_SUSPICIOUS_RATE_PER_HOUR } from "@/lib/constants";
import {
  getNextP2PBatchAction,
  sendP2PMessageAction,
  skipP2PAssignmentAction,
  getP2PAgentProgressAction,
  getContactHistoryAction,
} from "@/server/actions/p2p";
import {
  ArrowLeft,
  Send,
  SkipForward,
  RotateCcw,
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageSquare,
  Keyboard,
  X,
  AlertTriangle,
  PartyPopper,
  Inbox,
} from "lucide-react";

interface Assignment {
  assignmentId: string;
  contact: any;
  renderedBody: string;
  replyScript: string | null;
  mediaUrl: string | null;
  originalScript: string;
}

interface ProgressStats {
  total: number;
  sent: number;
  skipped: number;
  pending: number;
  replied: number;
}

export default function P2PSendPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [current, setCurrent] = useState<Assignment | null>(null);
  const [prefetched, setPrefetched] = useState<Assignment[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [includeMedia, setIncludeMedia] = useState(true);
  const [progress, setProgress] = useState<ProgressStats>({
    total: 0, sent: 0, skipped: 0, pending: 0, replied: 0,
  });
  const [contactHistory, setContactHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [, setShowHistoryMobile] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [showSkipInput, setShowSkipInput] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [sendCount, setLocalSendCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"in" | "out" | null>(null);
  const [quietHoursWarning, setQuietHoursWarning] = useState(false);
  const [contactDisplayedAt, setContactDisplayedAt] = useState<number>(Date.now());
  const [lastSentAssignmentId, setLastSentAssignmentId] = useState<string | null>(null);
  const [retryList, setRetryList] = useState<Array<{ assignmentId: string; contactName: string; error: string }>>([]);
  const slideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current);
      }
    };
  }, []);

  // Check quiet hours (8AM-9PM)
  useEffect(() => {
    function checkQuietHours() {
      const hour = new Date().getHours();
      setQuietHoursWarning(hour < 8 || hour >= 21);
    }
    checkQuietHours();
    const interval = setInterval(checkQuietHours, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load initial data
  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [batch, stats] = await Promise.all([
        getNextP2PBatchAction(campaignId, 1 + P2P_PREFETCH_COUNT),
        getP2PAgentProgressAction(campaignId),
      ]);
      setProgress(stats);

      if (batch.length === 0) {
        setCompleted(true);
        setLoading(false);
        return;
      }

      const [first, ...rest] = batch;
      setCurrent(first);
      setMessageBody(first.renderedBody);
      setIncludeMedia(!!first.mediaUrl);
      setPrefetched(rest);
      setContactDisplayedAt(Date.now());

      // Load contact history
      if (first.contact.id) {
        const history = await getContactHistoryAction(first.contact.id);
        setContactHistory(history);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Prefetch more assignments to replenish the buffer
  const prefetchNext = useCallback(() => {
    getNextP2PBatchAction(campaignId, P2P_PREFETCH_COUNT)
      .then((batch) => setPrefetched((prev) => [...prev, ...batch]))
      .catch((err) => {
        console.warn("P2P prefetch failed:", err?.message || err);
        // Warn the user if the buffer is running low
        setPrefetched((prev) => {
          if (prev.length < 2) {
            toast.warning("Failed to load upcoming contacts. Your queue may be running low.", {
              description: "Sending can continue, but new contacts may not load automatically.",
            });
          }
          return prev;
        });
      });
  }, [campaignId]);

  // Advance to next contact
  const advanceToNext = useCallback(async () => {
    setSlideDirection("out");
    await new Promise((r) => setTimeout(r, 150));

    if (prefetched.length > 0) {
      const [next, ...rest] = prefetched;
      setCurrent(next);
      setMessageBody(next.renderedBody);
      setIncludeMedia(!!next.mediaUrl);
      setPrefetched(rest);
      setContactDisplayedAt(Date.now());

      // Load history for new contact
      if (next.contact.id) {
        getContactHistoryAction(next.contact.id).then(setContactHistory).catch(() => setContactHistory([]));
      }

      // Prefetch more if running low
      if (rest.length < 2) {
        prefetchNext();
      }
    } else {
      // Try to get more
      try {
        const batch = await getNextP2PBatchAction(campaignId, 1 + P2P_PREFETCH_COUNT);
        if (batch.length === 0) {
          setCompleted(true);
          setCurrent(null);
        } else {
          const [next, ...rest] = batch;
          setCurrent(next);
          setMessageBody(next.renderedBody);
          setIncludeMedia(!!next.mediaUrl);
          setPrefetched(rest);
          setContactDisplayedAt(Date.now());
          if (next.contact.id) {
            getContactHistoryAction(next.contact.id).then(setContactHistory).catch(() => setContactHistory([]));
          }
        }
      } catch {
        setCompleted(true);
        setCurrent(null);
      }
    }

    // Update progress in background
    getP2PAgentProgressAction(campaignId)
      .then(setProgress)
      .catch(() => {});

    setSlideDirection("in");
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
    }
    slideTimeoutRef.current = setTimeout(() => setSlideDirection(null), 150);
  }, [prefetched, campaignId, prefetchNext]);

  // Add a failed assignment to the retry list
  function addToRetryList(assignmentId: string, contactName: string, error: string) {
    setRetryList((prev) => [...prev, { assignmentId, contactName, error }]);
  }

  // Send handler — fire-and-forget pattern for instant UI transitions
  async function handleSend() {
    if (!current) return;
    // Prevent double-send of the same contact
    if (current.assignmentId === lastSentAssignmentId) return;
    setLastSentAssignmentId(current.assignmentId);

    // 1. Capture timing for audit trail
    const sendLatencyMs = Date.now() - contactDisplayedAt;

    // 2. Snapshot the current assignment and message before transitioning
    const assignmentId = current.assignmentId;
    const body = messageBody;
    const media = includeMedia ? current.mediaUrl || undefined : undefined;
    const contactName = current.contact.firstName || current.contact.phone;

    // 3. Immediately advance the UI to the next contact
    setLocalSendCount((c) => c + 1);
    advanceToNext();

    // 4. Fire the server action in the background — do NOT await before advancing
    sendP2PMessageAction(assignmentId, body, media, sendLatencyMs)
      .then((result) => {
        if (result.skipped) {
          toast("Contact skipped", { description: result.reason });
        } else {
          toast.success(`Sent to ${contactName}`);
        }
        // Replenish prefetch buffer
        prefetchNext();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Failed to send to ${contactName}: ${msg}`);
        addToRetryList(assignmentId, contactName, msg);
      });
  }

  // Skip handler
  async function handleSkip(reason?: string) {
    if (!current) return;
    try {
      await skipP2PAssignmentAction(current.assignmentId, reason);
      const name = current.contact.firstName || current.contact.phone;
      toast(`Skipped ${name}`, { icon: <SkipForward className="h-4 w-4" /> });
      setShowSkipInput(false);
      setSkipReason("");
      await advanceToNext();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to skip");
    }
  }

  // Reset to script
  function handleReset() {
    if (current) {
      setMessageBody(current.renderedBody);
      setIncludeMedia(!!current.mediaUrl);
    }
  }

  // Stable refs for keyboard shortcut handlers to avoid stale closures
  const handleSendRef = useRef(handleSend);
  const handleSkipRef = useRef(handleSkip);
  const handleResetRef = useRef(handleReset);
  const showShortcutsRef = useRef(showShortcuts);
  const showSkipInputRef = useRef(showSkipInput);
  useEffect(() => { handleSendRef.current = handleSend; });
  useEffect(() => { handleSkipRef.current = handleSkip; });
  useEffect(() => { handleResetRef.current = handleReset; });
  useEffect(() => { showShortcutsRef.current = showShortcuts; }, [showShortcuts]);
  useEffect(() => { showSkipInputRef.current = showSkipInput; }, [showSkipInput]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't capture when typing in textarea/input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "TEXTAREA" || target.tagName === "INPUT";

      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowShortcuts((s) => !s);
        return;
      }
      if (e.key === "Escape") {
        if (showShortcutsRef.current) { setShowShortcuts(false); return; }
        if (showSkipInputRef.current) { setShowSkipInput(false); return; }
        setShowExitDialog(true);
        return;
      }
      if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || (e.key === "Enter" && !isInput)) {
        e.preventDefault();
        handleSendRef.current();
        return;
      }
      if (e.key === "s" && !isInput) {
        e.preventDefault();
        handleSkipRef.current();
        return;
      }
      if (e.key === "e" && !isInput) {
        e.preventDefault();
        textareaRef.current?.focus();
        return;
      }
      if (e.key === "r" && !isInput) {
        e.preventDefault();
        handleResetRef.current();
        return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Session timer
  const sessionMinutes = Math.floor((Date.now() - sessionStart) / 60000);
  const sendRate = sessionMinutes > 0 ? (sendCount / sessionMinutes).toFixed(1) : "0";
  const completionPercent = progress.total > 0
    ? ((progress.sent + progress.skipped) / progress.total) * 100
    : 0;
  const segments = countSegments(messageBody);
  const charCount = messageBody.length;
  const isModified = current && messageBody !== current.renderedBody;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading your queue...</p>
        </div>
      </div>
    );
  }

  if (completed) {
    // Show retry list if there are failed sends
    if (retryList.length > 0) {
      return (
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="max-w-lg w-full mx-4">
            <div className="text-center mb-6">
              <div className="h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-8 w-8 text-warning" />
              </div>
              <h1 className="text-2xl font-bold mb-1">{retryList.length} message{retryList.length !== 1 ? "s" : ""} failed to send</h1>
              <p className="text-muted-foreground text-sm">
                You can retry these or skip them and finish.
              </p>
            </div>
            <div className="space-y-2 mb-6">
              {retryList.map((item) => (
                <div key={item.assignmentId} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.contactName}</p>
                    <p className="text-xs text-destructive">{item.error}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        // Reload assignment for retry
                        const batch = await getNextP2PBatchAction(campaignId, 1);
                        if (batch.length > 0) {
                          setCurrent(batch[0]);
                          setMessageBody(batch[0].renderedBody);
                          setIncludeMedia(!!batch[0].mediaUrl);
                          setContactDisplayedAt(Date.now());
                          setLastSentAssignmentId(null);
                          setCompleted(false);
                          setRetryList((prev) => prev.filter((r) => r.assignmentId !== item.assignmentId));
                        } else {
                          toast.error("Could not reload assignment");
                        }
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Failed to retry");
                      }
                    }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setRetryList([]);
                }}
              >
                Skip and Finish
              </Button>
              <Button onClick={() => router.push(`/campaigns/${campaignId}`)}>
                Back to Campaign
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="text-center max-w-md">
          <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">You&apos;re done!</h1>
          <p className="text-muted-foreground mb-6">
            Great work! You sent {progress.sent} messages and skipped {progress.skipped}.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push("/inbox")} variant="outline">
              <Inbox className="h-4 w-4 mr-2" />
              Go to Inbox
            </Button>
            <Button onClick={() => router.push(`/campaigns/${campaignId}`)}>
              Back to Campaign
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const contact = current.contact;
  const contactName = contact.firstName
    ? `${contact.firstName} ${contact.lastName || ""}`.trim()
    : contact.phone;
  const initials = contact.firstName
    ? `${contact.firstName[0]}${contact.lastName?.[0] || ""}`.toUpperCase()
    : "?";

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -mt-4 md:-mt-6 -mx-4 md:-mx-6 bg-background">
      {/* Top Bar */}
      <div className="h-12 border-b flex items-center justify-between px-4 shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExitDialog(true)}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="hidden md:block h-4 w-px bg-border" />
          <span className="hidden md:inline text-sm font-medium truncate max-w-[200px]">
            P2P Campaign
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="hidden md:inline">
            <Clock className="h-3 w-3 inline mr-1" />
            {sessionMinutes}m &middot; {sendRate} msgs/min
          </span>
          <span className="font-mono font-medium text-foreground">
            {progress.sent + progress.skipped} / {progress.total}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setShowShortcuts(true)} className="text-muted-foreground hidden md:inline-flex">
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Compliance Warning Banners */}
      {quietHoursWarning && (
        <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center gap-2 text-warning text-sm shrink-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">Quiet hours active.</span>
          <span className="text-warning/80">Messages sent now will be queued until 8:00 AM.</span>
        </div>
      )}
      {(() => {
        const elapsedHours = (Date.now() - sessionStart) / 3600000;
        const ratePerHour = elapsedHours > 0.05 ? sendCount / elapsedHours : 0;
        if (ratePerHour > P2P_SUSPICIOUS_RATE_PER_HOUR) {
          return (
            <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center gap-2 text-destructive text-sm shrink-0">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-medium">High send rate detected.</span>
              <span className="text-destructive/80">
                Sending at {Math.round(ratePerHour)} msgs/hr exceeds the {P2P_SUSPICIOUS_RATE_PER_HOUR}/hr guideline. Please slow down.
              </span>
            </div>
          );
        }
        return null;
      })()}

      {/* Main Content — 3 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Contact Info */}
        <div
          className={`hidden lg:flex w-64 border-r flex-col shrink-0 overflow-y-auto p-4 space-y-4 transition-opacity duration-200 ${
            slideDirection ? "opacity-50" : "opacity-100"
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-14 w-14 mb-2">
              <AvatarFallback className="text-base bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="font-semibold">{contactName}</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{contact.phone}</p>
            <Badge
              variant={contact.optInStatus === "OPTED_IN" ? "success" : "destructive"}
              className="text-[10px] mt-1.5"
            >
              {contact.optInStatus?.replace("_", " ")}
            </Badge>
          </div>

          {contact.email && (
            <div className="flex items-center gap-2 text-xs">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {(contact.city || contact.state) && (
            <div className="flex items-center gap-2 text-xs">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{[contact.city, contact.state, contact.zip].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {contact.precinct && (
            <div className="flex items-center gap-2 text-xs">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>Precinct: {contact.precinct}</span>
            </div>
          )}

          {contact.tags?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {contact.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {contactHistory.length > 0 && (() => {
            const lastMsg = contactHistory[contactHistory.length - 1];
            const lastDate = new Date(lastMsg.createdAt);
            const hoursSince = (Date.now() - lastDate.getTime()) / 3600000;
            const isRecent = hoursSince < 24;
            return (
              <div className={`${isRecent ? "bg-warning/10 border-warning/20" : "bg-muted/50 border-muted"} border rounded-lg p-2`}>
                <p className={`text-[10px] font-medium flex items-center gap-1 ${isRecent ? "text-warning" : "text-muted-foreground"}`}>
                  {isRecent ? <AlertTriangle className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                  {isRecent ? "Messaged within 24h" : "Prior conversation"}
                </p>
                <p className={`text-[10px] mt-0.5 ${isRecent ? "text-warning/70" : "text-muted-foreground/70"}`}>
                  {contactHistory.length} message{contactHistory.length !== 1 ? "s" : ""} &middot; Last {
                    hoursSince < 1
                      ? `${Math.round(hoursSince * 60)}m ago`
                      : hoursSince < 24
                        ? `${Math.round(hoursSince)}h ago`
                        : `${Math.round(hoursSince / 24)}d ago`
                  }
                </p>
              </div>
            );
          })()}
        </div>

        {/* Center: Message Composer */}
        <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6">
          {/* Mobile contact header */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{contactName}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{contact.phone}</p>
            </div>
            {contactHistory.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistoryMobile(true)}
                className="text-xs shrink-0"
              >
                History ({contactHistory.length})
              </Button>
            )}
          </div>

          {/* Textarea */}
          <div className="flex-1 flex flex-col">
            <Textarea
              ref={textareaRef}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="flex-1 min-h-[120px] max-h-[300px] resize-none text-base leading-relaxed"
              placeholder="Message script..."
            />

            {/* Message meta */}
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span>{charCount} chars &middot; {segments} segment{segments !== 1 ? "s" : ""}</span>
                {current.mediaUrl && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMedia}
                      onChange={(e) => setIncludeMedia(e.target.checked)}
                      className="rounded"
                    />
                    <span>Include MMS</span>
                  </label>
                )}
              </div>
              {isModified && (
                <button onClick={handleReset} className="text-primary hover:underline flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" />
                  Reset to script
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-4">
            <Button
              onClick={handleSend}
              disabled={!messageBody.trim()}
              className="flex-1 h-12 text-base font-medium"
              size="lg"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
              <kbd className="hidden md:inline-flex ml-2 text-[10px] bg-primary-foreground/20 px-1.5 py-0.5 rounded">
                Enter
              </kbd>
            </Button>

            {showSkipInput ? (
              <div className="flex items-center gap-2">
                <Input
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-40 h-12"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleSkip(skipReason); }
                    if (e.key === "Escape") setShowSkipInput(false);
                  }}
                />
                <Button onClick={() => handleSkip(skipReason)} variant="secondary" className="h-12">
                  Skip
                </Button>
                <Button onClick={() => setShowSkipInput(false)} variant="ghost" size="icon" className="h-12 w-12">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => handleSkip()}
                variant="outline"
                className="h-12 px-6"
                size="lg"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
                <kbd className="hidden md:inline-flex ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                  S
                </kbd>
              </Button>
            )}
          </div>
        </div>

        {/* Right: Conversation History */}
        <div className="hidden lg:flex w-72 border-l flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Conversation History
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {contactHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground">
                  No previous conversations
                </p>
              </div>
            ) : (
              contactHistory.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-1.5 text-xs rounded-xl ${
                      msg.direction === "OUTBOUND"
                        ? "bg-primary/80 text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p className={`text-[9px] mt-0.5 ${
                      msg.direction === "OUTBOUND" ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}>
                      {new Date(msg.createdAt).toLocaleDateString()}
                      {msg.campaign?.name && ` · ${msg.campaign.name}`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="h-10 border-t flex items-center px-4 gap-4 shrink-0 bg-card text-xs">
        <Progress value={completionPercent} className="flex-1 h-2" />
        <span className="text-muted-foreground shrink-0">
          <span className="text-success font-medium">{progress.sent} sent</span>
          {progress.skipped > 0 && (
            <> &middot; <span className="text-warning font-medium">{progress.skipped} skipped</span></>
          )}
          &middot; {progress.pending} left
        </span>
      </div>

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave sending queue?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {progress.pending} contacts remaining. You can resume later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Sending</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(`/campaigns/${campaignId}`)}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowShortcuts(false)}>
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Keyboard Shortcuts</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowShortcuts(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ["Enter", "Send message & advance"],
                ["S", "Skip contact"],
                ["E", "Edit message"],
                ["R", "Reset to original script"],
                ["Esc", "Back to campaign"],
                ["?", "Toggle this help"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{desc}</span>
                  <kbd className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{key}</kbd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
