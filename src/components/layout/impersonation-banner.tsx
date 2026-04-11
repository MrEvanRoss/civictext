"use client";

import { useEffect, useState } from "react";
import { getImpersonationInfo } from "@/server/actions/auth";
import { Shield, ArrowLeft } from "lucide-react";

export function ImpersonationBanner() {
  const [info, setInfo] = useState<{
    isImpersonating: boolean;
    targetOrgName?: string;
  } | null>(null);

  useEffect(() => {
    checkImpersonation();
  }, []);

  // Set/clear a data attribute on <html> so the sidebar and other fixed
  // elements can offset themselves with pure CSS (see globals.css).
  useEffect(() => {
    if (info?.isImpersonating) {
      document.documentElement.setAttribute("data-impersonating", "true");
    }
    return () => {
      document.documentElement.removeAttribute("data-impersonating");
    };
  }, [info?.isImpersonating]);

  async function checkImpersonation() {
    try {
      const data = await getImpersonationInfo();
      if (data?.isImpersonating) {
        setInfo(data);
      }
    } catch {
      // Not impersonating or not admin
    }
  }

  if (!info?.isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium shadow-md h-10">
      <div className="flex items-center gap-2 min-w-0">
        <Shield className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">
          Viewing as{" "}
          <strong>{info.targetOrgName || "client"}</strong>
        </span>
      </div>
      <button
        onClick={() => {
          window.location.href = "/api/admin/stop-impersonate";
        }}
        className="flex items-center gap-1.5 bg-amber-900 hover:bg-amber-950 text-white px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex-shrink-0"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Return to Admin
      </button>
    </div>
  );
}
