"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, X, CheckCircle2, AlertCircle } from "lucide-react";
import { countSegments, hasUnicodeChars, getRemainingChars } from "@/lib/sms-utils";
import { sendTestMessageAction } from "@/server/actions/campaigns";

// Matches http(s):// URLs, www. URLs, and bare domain URLs (e.g. Google.com, example.org/path)
const URL_REGEX = /(?:https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:com|org|net|gov|edu|io|co|us|info|biz|me|app|dev|xyz|tv|ai|news|site|store|tech|online|shop|club|pro|page|link)(?:\/[^\s]*)?)/gi;

/**
 * Normalize a URL — ensure it has a protocol for URL parsing.
 */
function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

/**
 * Extract domain from a URL for display.
 */
function extractDomain(url: string): string {
  try {
    const u = new URL(normalizeUrl(url));
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Generate a mock page title from a URL path.
 */
function generateMockTitle(url: string): string {
  try {
    const u = new URL(normalizeUrl(url));
    const path = u.pathname.replace(/^\/|\/$/g, "");
    if (!path) {
      // No path — capitalize the domain as title
      const domain = u.hostname.replace(/^www\./, "");
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
    // Convert path slug to title case
    return path
      .split("/")
      .pop()!
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Link Preview";
  }
}

/**
 * Render message text only (URLs shown as blue underlined text within bubble).
 * Returns just the inline content — the rich link card is rendered separately.
 */
function renderMessageText(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  const urls = text.match(URL_REGEX) || [];

  if (urls.length === 0) return text;

  const result: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) result.push(part);
    if (i < urls.length) {
      result.push(
        <span key={`link-${i}`} className="underline text-[#aadcff] break-all cursor-pointer">
          {urls[i]}
        </span>
      );
    }
  });
  return result;
}

/**
 * Extract all URLs from text.
 */
function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

/**
 * Cached OG metadata to avoid re-fetching the same URL.
 */
const ogCache = new Map<string, OgData>();

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  /** "og" = full-size Open Graph image, "icon" = small favicon/apple-touch-icon */
  imageType: "og" | "icon" | null;
  domain: string;
}

/**
 * iOS-style rich link preview card — rendered as a separate element below the
 * message bubble, exactly like iMessage shows link previews.
 *
 * Fetches real Open Graph metadata (title, image) from /api/og-preview.
 */
function LinkPreviewCard({ url }: { url: string }) {
  const domain = extractDomain(url);
  const fallbackTitle = generateMockTitle(url);

  const [ogData, setOgData] = useState<OgData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;

    const normalizedUrl = normalizeUrl(url);

    // Check cache first
    const cached = ogCache.get(normalizedUrl);
    if (cached) {
      setOgData(cached);
      return;
    }

    setLoading(true);
    const controller = new AbortController();

    fetch(`/api/og-preview?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: OgData) => {
        ogCache.set(normalizedUrl, data);
        setOgData(data);
      })
      .catch(() => {
        // Ignore abort / network errors — show fallback
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [url]);

  const title = ogData?.title || fallbackTitle;
  const displayDomain = ogData?.domain || domain;
  const rawImageUrl = ogData?.image || null;

  // Proxy external images through our server to avoid hotlinking / referrer blocks
  const imageUrl = rawImageUrl
    ? `/api/og-image?url=${encodeURIComponent(rawImageUrl)}`
    : null;

  // Pick a branded accent color for the gradient background
  const colors = [
    "from-blue-600 to-blue-800",
    "from-indigo-600 to-indigo-800",
    "from-purple-600 to-purple-800",
    "from-teal-600 to-teal-800",
    "from-emerald-600 to-emerald-800",
  ];
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = url.charCodeAt(i) + ((hash << 5) - hash);
  const colorClass = colors[Math.abs(hash) % colors.length];

  return (
    <div className="ml-auto max-w-[85%] w-fit rounded-2xl overflow-hidden shadow-sm">
      {/* Image / hero area — always full-width, just like iOS */}
      {loading ? (
        <div
          className={`bg-gradient-to-br ${colorClass} flex items-center justify-center`}
          style={{ width: "100%", height: 120 }}
        >
          <svg className="animate-spin h-6 w-6 text-white/30" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : imageUrl ? (
        /* Image fills the hero area */
        <div className="relative bg-gray-900" style={{ width: "100%", height: 120 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                parent.classList.add("bg-gradient-to-br", ...colorClass.split(" "));
              }
            }}
          />
        </div>
      ) : (
        /* No image — gradient fallback */
        <div
          className={`bg-gradient-to-br ${colorClass} flex items-center justify-center`}
          style={{ width: "100%", height: 120 }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white/30"
          >
            <path
              d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
      {/* Title + domain */}
      <div className="bg-[#1c1c1e] px-3 py-2.5">
        <p className="text-[13px] font-semibold text-gray-100 leading-tight line-clamp-2">
          {title}
        </p>
        <p className="text-[11px] text-gray-500 mt-0.5">{displayDomain}</p>
      </div>
    </div>
  );
}

/** Example values for merge field rendering */
const MERGE_FIELD_EXAMPLES: Record<string, string> = {
  "{{prefix}}": "Ms.",
  "{{firstName}}": "Jane",
  "{{lastName}}": "Smith",
  "{{suffix}}": "",
  "{{fullName}}": "Ms. Jane Smith",
  "{{phone}}": "(212) 555-1234",
  "{{email}}": "jane@example.com",
  "{{street}}": "123 Main St",
  "{{city}}": "Springfield",
  "{{state}}": "IL",
  "{{zip}}": "62701",
  "{{address}}": "123 Main St, Springfield, IL 62701",
  "{{precinct}}": "District 5",
  "{{orgName}}": "CivicText",
  "{{pollingLocation}}": "Your local polling place",
  "{{electionDate}}": "Election Day",
  "{{pollHours}}": "7:00 AM - 8:00 PM",
  "{{pollCloseTime}}": "8:00 PM",
  "{{earlyVoteEnd}}": "the deadline",
};

export interface PhonePreviewProps {
  message: string;
  mediaUrl?: string;
  orgName?: string;
  /** Override merge field example values (e.g. GOTV fields) */
  mergeOverrides?: Record<string, string>;
  /** Show "Send Test Message" button below the preview */
  showSendTest?: boolean;
}

export function PhonePreview({
  message,
  mediaUrl,
  orgName,
  mergeOverrides,
  showSendTest = false,
}: PhonePreviewProps) {
  // Build resolved message with merge field examples
  const examples = { ...MERGE_FIELD_EXAMPLES, ...mergeOverrides };
  if (orgName) {
    examples["{{orgName}}"] = orgName;
  }

  let resolvedMessage = message;
  for (const [field, value] of Object.entries(examples)) {
    resolvedMessage = resolvedMessage.replaceAll(field, value);
  }

  const charCount = message.length;
  const segmentCount = countSegments(message);
  const isUnicode = hasUnicodeChars(message);
  const remaining = getRemainingChars(message);
  const displayName = orgName || "Your Organization";

  return (
    <div className="flex flex-col items-center w-full">
      {/* iPhone-style frame — scales down on very small screens */}
      <div
        className="relative border-[3px] border-gray-700 dark:border-gray-500 bg-black w-[280px] max-w-full"
        style={{
          minHeight: 560,
          borderRadius: 36,
        }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1">
          <span className="text-[10px] text-gray-400 font-medium">9:41</span>
          <div
            className="bg-gray-700 dark:bg-gray-500 rounded-full"
            style={{ width: 80, height: 22 }}
            aria-hidden="true"
          />
          <div className="flex items-center gap-1">
            <svg
              className="text-gray-400"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="1" y="14" width="4" height="8" rx="1" />
              <rect x="7" y="10" width="4" height="12" rx="1" />
              <rect x="13" y="6" width="4" height="16" rx="1" />
              <rect x="19" y="2" width="4" height="20" rx="1" />
            </svg>
            <svg
              className="text-gray-400"
              width="16"
              height="12"
              viewBox="0 0 24 14"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="0" y="2" width="20" height="10" rx="2" />
              <rect x="21" y="5" width="3" height="4" rx="1" />
            </svg>
          </div>
        </div>

        {/* Contact header */}
        <div className="border-b border-gray-800 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gray-600 flex items-center justify-center">
              <span className="text-[10px] text-gray-300 font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-200 leading-tight">
                {displayName}
              </p>
              <p className="text-[9px] text-gray-500 leading-tight">
                Text Message
              </p>
            </div>
          </div>
        </div>

        {/* Message area */}
        <div className="px-3 py-3 flex-1" style={{ minHeight: 360 }}>
          {resolvedMessage ? (
            <div className="space-y-2">
              {/* Media attachment */}
              {mediaUrl && (
                <div className="ml-auto max-w-[85%] w-fit">
                  {mediaUrl.match(/\.(mp4|3gp|3gpp)$/i) ? (
                    <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-400 text-center">
                      [Video attachment]
                    </div>
                  ) : (
                    <Image
                      src={mediaUrl}
                      alt="MMS preview"
                      width={220}
                      height={128}
                      className="max-h-32 rounded-xl object-contain"
                      unoptimized
                    />
                  )}
                </div>
              )}
              {/* Message bubble */}
              <div className="bg-[#34C759] text-white rounded-2xl rounded-tr-sm px-3 py-2 text-[13px] leading-snug ml-auto max-w-[85%] w-fit whitespace-pre-wrap break-words shadow-sm">
                {renderMessageText(resolvedMessage)}
              </div>
              {/* Rich link preview card — separate from the bubble, just like iOS */}
              {extractUrls(resolvedMessage).length > 0 && (
                <LinkPreviewCard url={extractUrls(resolvedMessage)[extractUrls(resolvedMessage).length - 1]} />
              )}
              {/* Delivery indicator */}
              <p className="text-right text-[9px] text-gray-500 pr-1">
                Delivered
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-xs text-gray-600 text-center">
                Start typing to see your
                <br />
                message preview here
              </p>
            </div>
          )}
        </div>

        {/* Bottom input bar */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-4 pt-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
              <svg
                className="text-gray-400"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div className="flex-1 rounded-full border border-gray-700 px-3 py-1.5">
              <span className="text-[11px] text-gray-600">Text Message</span>
            </div>
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
          <div
            className="bg-gray-600 rounded-full"
            style={{ width: 100, height: 4 }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Stats below the phone */}
      <div className="mt-3 text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{charCount}</span>
          {" / "}
          {isUnicode ? "70" : "160"}
          {" chars"}
          <span className="mx-2 text-muted-foreground/50">&middot;</span>
          <span
            className={`font-medium ${
              segmentCount > 3
                ? "text-orange-500"
                : segmentCount > 1
                  ? "text-yellow-500"
                  : "text-green-500"
            }`}
          >
            {segmentCount} segment{segmentCount !== 1 ? "s" : ""}
          </span>
        </p>
        {charCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {remaining} character{remaining !== 1 ? "s" : ""} remaining in
            current segment
          </p>
        )}
        {isUnicode && (
          <p className="text-xs text-yellow-500">
            Unicode detected — segment limit is 70 characters
          </p>
        )}
      </div>

      {/* Send Test Message button */}
      {showSendTest && message.trim() && (
        <SendTestButton message={message} mediaUrl={mediaUrl} />
      )}
    </div>
  );
}

// ===========================================================================
// Send Test Message inline component
// ===========================================================================

function SendTestButton({ message, mediaUrl }: { message: string; mediaUrl?: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleSend() {
    if (!phone.trim() || !message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await sendTestMessageAction({
        phone: phone.trim(),
        messageBody: message,
        mediaUrl: mediaUrl || undefined,
      });
      setResult({ success: `Sent to ${res.phone}` });
      timeoutRef.current = setTimeout(() => {
        setResult(null);
        setOpen(false);
        setPhone("");
      }, 3000);
    } catch (err: unknown) {
      setResult({ error: err instanceof Error ? err.message : "Failed to send" });
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setOpen(true)}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Send Test Message
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Send Test Message</p>
        <button onClick={() => { setOpen(false); setResult(null); }} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Send this message to a phone number for testing. Test messages count toward your balance.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="test-phone" className="text-xs">Phone Number</Label>
        <Input
          id="test-phone"
          type="tel"
          placeholder="(555) 123-4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {result?.success && (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {result.success}
        </div>
      )}
      {result?.error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {result.error}
        </div>
      )}

      <Button
        size="sm"
        className="w-full"
        disabled={sending || !phone.trim()}
        onClick={handleSend}
      >
        <Send className="h-3.5 w-3.5 mr-1.5" />
        {sending ? "Sending..." : "Send Test"}
      </Button>
    </div>
  );
}
