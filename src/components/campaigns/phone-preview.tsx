"use client";

import React from "react";
import Image from "next/image";
import { countSegments, hasUnicodeChars, getRemainingChars } from "@/lib/sms-utils";

const URL_REGEX = /https?:\/\/[^\s]+/g;

/**
 * Client-side preview: replace URLs with sample short-link format.
 */
function previewWithShortLinks(text: string): string {
  return text.replace(URL_REGEX, () => {
    const domain =
      typeof window !== "undefined" ? window.location.host : "civictext.app";
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
}

export function PhonePreview({
  message,
  mediaUrl,
  orgName,
  mergeOverrides,
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
    <div className="flex flex-col items-center">
      {/* iPhone-style frame */}
      <div
        className="relative border-[3px] border-gray-700 dark:border-gray-500 bg-black"
        style={{
          width: 280,
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
                {renderPreviewWithLinks(resolvedMessage)}
              </div>
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
    </div>
  );
}
